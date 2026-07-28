"use client"

import { useState } from "react"
import { AccountEntryModal } from "@/components/AccountEntryModal"
import { useAccounts } from "@/hooks/use-finance"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CreditCard, Plus, MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function CardsPage() {
  const { data: accounts, isLoading } = useAccounts()
  const cards = accounts?.filter((a: any) => a.type === 'CREDIT_CARD') || []
  const [isModalOpen, setIsModalOpen] = useState(false)

  return (
    <div className="space-y-6">
      <AccountEntryModal open={isModalOpen} onOpenChange={setIsModalOpen} defaultType="CREDIT_CARD" />
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Credit Cards</h1>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Add Card
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <div className="col-span-3 py-8 text-center text-muted-foreground">Loading cards...</div>
        ) : cards.length === 0 ? (
          <div className="col-span-3 py-8 text-center text-muted-foreground">No credit cards found. Add one to get started.</div>
        ) : (
          cards.map((card: any) => {
            const utilization = card.creditLimit ? (card.currentBalance / card.creditLimit) * 100 : 0
            
            return (
              <Card key={card.id} className="relative overflow-hidden">
                <div 
                  className="absolute left-0 top-0 bottom-0 w-1" 
                  style={{ backgroundColor: card.color || '#FF8042' }} 
                />
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-lg font-medium">{card.name}</CardTitle>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-destructive">₹{card.currentBalance.toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground mt-1 flex justify-between">
                    <span>Outstanding</span>
                    {card.creditLimit && <span>Limit: ₹{card.creditLimit.toLocaleString()}</span>}
                  </div>
                  {card.creditLimit && (
                    <div className="mt-4 w-full bg-secondary rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${utilization > 80 ? 'bg-destructive' : 'bg-primary'}`} 
                        style={{ width: `${Math.min(utilization, 100)}%` }} 
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}
