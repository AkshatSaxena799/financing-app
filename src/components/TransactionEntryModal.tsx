"use client"

import { useState } from "react"
import { useAddTransaction, useAccounts, useCategories } from "@/hooks/use-finance"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus } from "lucide-react"

export function TransactionEntryModal() {
  const [open, setOpen] = useState(false)
  const { data: accounts } = useAccounts()
  const { data: categories } = useCategories()
  const addTransaction = useAddTransaction()

  const [formData, setFormData] = useState({
    amount: "",
    type: "EXPENSE",
    date: new Date().toISOString().substring(0, 16), // YYYY-MM-DDThh:mm
    accountId: "",
    categoryId: "",
    merchant: "",
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Convert date string back to full ISO string
    const dateObj = new Date(formData.date)
    
    addTransaction.mutate({
      ...formData,
      amount: parseFloat(formData.amount),
      date: dateObj.toISOString()
    }, {
      onSuccess: () => {
        setOpen(false)
        setFormData({ ...formData, amount: "", merchant: "" }) // Reset partial
      }
    })
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="mr-2 h-4 w-4" /> Add Transaction
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add Transaction</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select value={formData.type} onValueChange={(val) => { if (val) setFormData({...formData, type: val}) }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EXPENSE">Expense</SelectItem>
                    <SelectItem value="INCOME">Income</SelectItem>
                    <SelectItem value="TRANSFER">Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input 
                  id="amount" 
                  type="number" 
                  step="0.01"
                  required 
                  value={formData.amount} 
                  onChange={(e) => setFormData({...formData, amount: e.target.value})} 
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="date">Date &amp; Time</Label>
              <Input 
                id="date" 
                type="datetime-local" 
                required 
                value={formData.date} 
                onChange={(e) => setFormData({...formData, date: e.target.value})} 
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="account">Account</Label>
              <Select value={formData.accountId} onValueChange={(val) => { if (val) setFormData({...formData, accountId: val}) }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts?.map((acc: any) => (
                    <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={formData.categoryId} onValueChange={(val) => { if (val) setFormData({...formData, categoryId: val}) }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent>
                  {categories?.map((cat: any) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="merchant">Merchant / Description</Label>
              <Input 
                id="merchant" 
                value={formData.merchant} 
                onChange={(e) => setFormData({...formData, merchant: e.target.value})} 
              />
            </div>

            <Button type="submit" className="w-full" disabled={addTransaction.isPending}>
              {addTransaction.isPending ? "Saving..." : "Save Transaction"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
