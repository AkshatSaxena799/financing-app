import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { categorySchema } from '@/lib/validations'
import { z } from 'zod'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return new NextResponse("Unauthorized", { status: 401 })

    const categories = await prisma.category.findMany({
      where: { user: { clerkUserId: userId } },
      include: { subcategories: true },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json(categories)
  } catch (error) {
    console.error("[CATEGORIES_GET]", error)
    return new NextResponse("Internal Error", { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return new NextResponse("Unauthorized", { status: 401 })

    const userRecord = await prisma.user.findUnique({ where: { clerkUserId: userId } })
    if (!userRecord) return new NextResponse("User not found in DB", { status: 404 })

    const body = await req.json()
    const parsed = categorySchema.parse(body)

    const category = await prisma.category.create({
      data: {
        ...parsed,
        userId: userRecord.id,
      }
    })

    return NextResponse.json(category)
  } catch (error) {
    if (error instanceof z.ZodError) return new NextResponse(JSON.stringify(error.errors), { status: 400 })
    console.error("[CATEGORIES_POST]", error)
    return new NextResponse("Internal Error", { status: 500 })
  }
}
