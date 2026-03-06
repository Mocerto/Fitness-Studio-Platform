import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { createProductSchema } from "@/lib/product-validation";
import { prisma } from "@/lib/prisma";
import { getStudioId, missingStudioHeaderResponse } from "@/lib/tenant";

export async function GET(request: NextRequest) {
  const studioId = await getStudioId();
  if (!studioId) {
    return missingStudioHeaderResponse();
  }

  const categoryId = request.nextUrl.searchParams.get("category_id");
  const activeOnly = request.nextUrl.searchParams.get("active");
  const lowStock = request.nextUrl.searchParams.get("low_stock");

  const where: Prisma.ProductWhereInput = { studio_id: studioId };

  if (categoryId) {
    where.category_id = categoryId;
  }

  if (activeOnly === "true") {
    where.is_active = true;
  }

  if (lowStock === "true") {
    where.low_stock_threshold = { not: null };
    where.current_stock = { lte: prisma.product.fields.low_stock_threshold as unknown as number };
  }

  try {
    const products = await prisma.product.findMany({
      where,
      include: {
        category: { select: { id: true, name: true } },
      },
      orderBy: { name: "asc" },
    });

    // Filter low stock in application if the raw query approach doesn't work
    const result =
      lowStock === "true"
        ? products.filter((p) => p.low_stock_threshold != null && p.current_stock <= p.low_stock_threshold)
        : products;

    return NextResponse.json({ data: result });
  } catch {
    return NextResponse.json({ message: "failed to load products" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const studioId = await getStudioId();
  if (!studioId) {
    return missingStudioHeaderResponse();
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "invalid json body" }, { status: 400 });
  }

  const parsedBody = createProductSchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json(
      { message: "validation error", errors: parsedBody.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const product = await prisma.product.create({
      data: {
        studio_id: studioId,
        name: parsedBody.data.name,
        description: parsedBody.data.description,
        sku: parsedBody.data.sku,
        category_id: parsedBody.data.category_id,
        price_cents: parsedBody.data.price_cents,
        cost_cents: parsedBody.data.cost_cents,
        current_stock: parsedBody.data.current_stock,
        low_stock_threshold: parsedBody.data.low_stock_threshold,
      },
      include: {
        category: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ data: product }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ message: "product with this SKU already exists" }, { status: 409 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json({ message: "invalid category_id" }, { status: 400 });
    }
    return NextResponse.json({ message: "failed to create product" }, { status: 500 });
  }
}
