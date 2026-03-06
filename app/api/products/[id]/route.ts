import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { idParamSchema, updateProductSchema } from "@/lib/product-validation";
import { prisma } from "@/lib/prisma";
import { getStudioId, missingStudioHeaderResponse } from "@/lib/tenant";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const studioId = await getStudioId();
  if (!studioId) {
    return missingStudioHeaderResponse();
  }

  const { id } = await params;
  const parsedId = idParamSchema.safeParse(id);
  if (!parsedId.success) {
    return NextResponse.json({ message: "invalid product id" }, { status: 400 });
  }

  try {
    const product = await prisma.product.findUnique({
      where: { studio_id_id: { studio_id: studioId, id: parsedId.data } },
      include: {
        category: { select: { id: true, name: true } },
      },
    });

    if (!product) {
      return NextResponse.json({ message: "product not found" }, { status: 404 });
    }

    return NextResponse.json({ data: product });
  } catch {
    return NextResponse.json({ message: "failed to load product" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const studioId = await getStudioId();
  if (!studioId) {
    return missingStudioHeaderResponse();
  }

  const { id } = await params;
  const parsedId = idParamSchema.safeParse(id);
  if (!parsedId.success) {
    return NextResponse.json({ message: "invalid product id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "invalid json body" }, { status: 400 });
  }

  const parsedBody = updateProductSchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json(
      { message: "validation error", errors: parsedBody.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const product = await prisma.product.update({
      where: { studio_id_id: { studio_id: studioId, id: parsedId.data } },
      data: parsedBody.data,
      include: {
        category: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ data: product });
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ message: "product not found" }, { status: 404 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ message: "product with this SKU already exists" }, { status: 409 });
    }
    return NextResponse.json({ message: "failed to update product" }, { status: 500 });
  }
}
