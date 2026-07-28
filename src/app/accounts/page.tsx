"use client"

import { useState } from "react"
import { AccountEntryModal } from "@/components/AccountEntryModal"
import { useAccounts } from "@/hooks/use-finance"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Wallet, Plus, MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function AccountsPage() {
  const { data: accounts, isLoading } = useAccounts()
  const [isModalOpen, setIsModalOpen] = useState(false)

  return (
    <div className="space-y-6">
      <AccountEntryModal open={isModalOpen} onOpenChange={setIsModalOpen} />
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Accounts</h1>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Add Account
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <div className="col-span-3 py-8 text-center text-muted-foreground">Loading accounts...</div>
        ) : accounts?.length === 0 ? (
          <div className="col-span-3 py-8 text-center text-muted-foreground">No accounts found. Add one to get started.</div>
        ) : (
          accounts?.map((account: any) => (
            <Card key={account.id} className="relative overflow-hidden">
              <div 
                className="absolute left-0 top-0 bottom-0 w-1" 
                style={{ backgroundColor: account.color || '#00C49F' }} 
              />
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg font-medium">{account.name}</CardTitle>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">₹{account.currentBalance.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground mt-1">
                  {account.type.replace('_', ' ')} {account.bankName ? `• ${account.bankName}` : ''}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
