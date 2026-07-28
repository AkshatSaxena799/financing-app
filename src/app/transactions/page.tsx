"use client"

import { useState } from "react"
import { useTransactions } from "@/hooks/use-finance"
import { format } from "date-fns"
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"
import { TransactionEntryModal } from "@/components/TransactionEntryModal"

export default function TransactionsPage() {
  const { data: transactions, isLoading } = useTransactions()
  const [searchTerm, setSearchTerm] = useState("")

  const filteredTransactions = transactions?.filter((tx: any) => 
    tx.merchant?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tx.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tx.category?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
        <TransactionEntryModal />
      </div>

      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search transactions..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-md border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Merchant/Description</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Account</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Loading transactions...
                </TableCell>
              </TableRow>
            ) : filteredTransactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No transactions found.
                </TableCell>
              </TableRow>
            ) : (
              filteredTransactions.map((tx: any) => (
                <TableRow key={tx.id}>
                  <TableCell>{format(new Date(tx.date), "MMM d, yyyy")}</TableCell>
                  <TableCell className="font-medium">
                    {tx.merchant || tx.description || "—"}
                  </TableCell>
                  <TableCell>{tx.category?.name || "Uncategorized"}</TableCell>
                  <TableCell>{tx.account?.name}</TableCell>
                  <TableCell className={`text-right font-medium ${tx.type === 'INCOME' ? 'text-green-600 dark:text-green-400' : ''}`}>
                    {tx.type === 'INCOME' ? '+' : '-'}₹{tx.amount.toLocaleString()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
