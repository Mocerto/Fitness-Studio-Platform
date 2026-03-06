import { NextRequest, NextResponse } from "next/server";
import { InventoryTransactionType, Prisma } from "@prisma/client";

import {
  createInventoryTransactionSchema,
  inventoryTransactionTypeSchema,
} from "@/lib/product-validation";
import { prisma } from "@/lib/prisma";
import { getStudioId, missingStudioHeaderResponse } from "@/lib/tenant";
import { auth } from "@/auth";

export async function GET(request: NextRequest) {
  const studioId = await getStudioId();
  if (!studioId) {
    return missingStudioHeaderResponse();
  }

  const productId = request.nextUrl.searchParams.get("product_id");
  const typeQuery = request.nextUrl.searchParams.get("type");

  const where: Prisma.InventoryTransactionWhereInput = { studio_id: studioId };

  if (productId) {
    where.product_id = productId;
  }

  if (typeQuery) {
    const parsedType = inventoryTransactionTypeSchema.safeParse(typeQuery);
    if (!parsedType.success) {
      return NextResponse.json(
        { message: "invalid type query", errors: parsedType.error.flatten() },
        { status: 400 },
      );
    }
    where.type = parsedType.data;
  }

  try {
    const transactions = await prisma.inventoryTransaction.findMany({
      where,
      include: {
        product: { select: { id: true, name: true, sku: true } },
        recorded_by_user: { select: { id: true, full_name: true, email: true } },
      },
      orderBy: { created_at: "desc" },
    });

    return NextResponse.json({ data: transactions });
  } catch {
    return NextResponse.json({ message: "failed to load inventory transactions" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const studioId = await getStudioId();
  if (!studioId) {
    return missingStudioHeaderResponse();
  }

  const session = await auth();
  const userId = session?.user?.id ?? null;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "invalid json body" }, { status: 400 });
  }

  const parsedBody = createInventoryTransactionSchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json(
      { message: "validation error", errors: parsedBody.error.flatten() },
      { status: 400 },
    );
  }

  const { product_id, type, quantity, unit_cost_cents, note } = parsedBody.data;

  // Determine stock change: PURCHASE and RETURN add stock, SALE and ADJUSTMENT subtract
  const stockDelta =
    type === InventoryTransactionType.PURCHASE || type === InventoryTransactionType.RETURN
      ? quantity
      : -quantity;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Verify product exists and check stock for outgoing transactions
      const product = await tx.product.findUnique({
        where: { studio_id_id: { studio_id: studioId, id: product_id } },
      });

      if (!product) {
        throw new Error("PRODUCT_NOT_FOUND");
      }

      if (stockDelta < 0 && product.current_stock + stockDelta < 0) {
        throw new Error("INSUFFICIENT_STOCK");
      }

      // Create transaction and update stock atomically
      const transaction = await tx.inventoryTransaction.create({
        data: {
          studio_id: studioId,
          product_id,
          type,
          quantity,
          unit_cost_cents,
          note,
          recorded_by_user_id: userId,
        },
        include: {
          product: { select: { id: true, name: true, sku: true } },
          recorded_by_user: { select: { id: true, full_name: true, email: true } },
        },
      });

      await tx.product.update({
        where: { studio_id_id: { studio_id: studioId, id: product_id } },
        data: { current_stock: { increment: stockDelta } },
      });

      return transaction;
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "PRODUCT_NOT_FOUND") {
      return NextResponse.json({ message: "product not found" }, { status: 404 });
    }
    if (error instanceof Error && error.message === "INSUFFICIENT_STOCK") {
      return NextResponse.json({ message: "insufficient stock" }, { status: 400 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json({ message: "invalid product_id" }, { status: 400 });
    }
    return NextResponse.json({ message: "failed to create inventory transaction" }, { status: 500 });
  }
}
