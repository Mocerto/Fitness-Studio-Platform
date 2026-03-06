import { NextResponse } from "next/server";
import { BillingPeriod, ContractStatus, PlanType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getStudioId, missingStudioHeaderResponse } from "@/lib/tenant";

function addOneMonth(date: Date): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + 1);
  return result;
}

// POST /api/contracts/billing-reset
// Resets remaining_classes for all active LIMITED+MONTHLY contracts
// whose next_billing_date has passed. Advances next_billing_date by one month.
// Call this from a cron job (daily) or manually from the dashboard.
export async function POST() {
  const studioId = await getStudioId();
  if (!studioId) {
    return missingStudioHeaderResponse();
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  try {
    // Find all active LIMITED+MONTHLY contracts that need resetting
    const dueContracts = await prisma.contract.findMany({
      where: {
        studio_id: studioId,
        status: ContractStatus.ACTIVE,
        plan_type_snapshot: PlanType.LIMITED,
        billing_period_snapshot: BillingPeriod.MONTHLY,
        next_billing_date: { lte: today },
      },
      include: {
        member: { select: { id: true, first_name: true, last_name: true } },
        plan: { select: { id: true, name: true } },
      },
    });

    if (dueContracts.length === 0) {
      return NextResponse.json({ data: { reset_count: 0, contracts: [] } });
    }

    // Reset each contract's remaining_classes and advance next_billing_date
    const results = await Promise.all(
      dueContracts.map(async (contract) => {
        const newNextBilling = contract.next_billing_date
          ? addOneMonth(contract.next_billing_date)
          : addOneMonth(today);

        const updated = await prisma.contract.update({
          where: { studio_id_id: { studio_id: studioId, id: contract.id } },
          data: {
            remaining_classes: contract.class_limit_snapshot,
            next_billing_date: newNextBilling,
          },
        });

        return {
          contract_id: updated.id,
          member: `${contract.member.first_name} ${contract.member.last_name}`,
          plan: contract.plan.name,
          remaining_classes: updated.remaining_classes,
          next_billing_date: updated.next_billing_date,
        };
      }),
    );

    return NextResponse.json({
      data: { reset_count: results.length, contracts: results },
    });
  } catch {
    return NextResponse.json({ message: "failed to process billing reset" }, { status: 500 });
  }
}
