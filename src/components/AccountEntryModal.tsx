"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAddAccount } from "@/hooks/use-finance"

const accountSchema = z.object({
  name: z.string().min(1, "Name is required"),
  bankName: z.string().optional(),
  type: z.enum(['SAVINGS', 'CURRENT', 'WALLET', 'CREDIT_CARD']),
  openingBalance: z.number().default(0),
  color: z.string().optional(),
  
  // Credit card specific fields
  creditLimit: z.number().optional(),
  network: z.string().optional(),
})

interface AccountEntryModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultType?: 'SAVINGS' | 'CURRENT' | 'WALLET' | 'CREDIT_CARD'
}

export function AccountEntryModal({ open, onOpenChange, defaultType }: AccountEntryModalProps) {
  const addAccount = useAddAccount()

  const form = useForm<z.infer<typeof accountSchema>>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      name: "",
      bankName: "",
      type: defaultType || "SAVINGS",
      openingBalance: 0,
      color: "#000000",
      creditLimit: undefined,
      network: "",
    },
  })

  const watchType = form.watch("type")

  const onSubmit = async (values: z.infer<typeof accountSchema>) => {
    try {
      await addAccount.mutateAsync({
        ...values,
        openingBalance: watchType === 'CREDIT_CARD' ? -Math.abs(values.openingBalance) : values.openingBalance
      })
      form.reset()
      onOpenChange(false)
    } catch (error) {
      console.error(error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Account</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Account Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!!defaultType}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="SAVINGS">Savings Account</SelectItem>
                      <SelectItem value="CURRENT">Current Account</SelectItem>
                      <SelectItem value="WALLET">Digital Wallet</SelectItem>
                      <SelectItem value="CREDIT_CARD">Credit Card</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Account Name</FormLabel>
                  <FormControl>
                    <Input placeholder={watchType === 'CREDIT_CARD' ? "e.g. HDFC Millennia" : "e.g. Main Savings"} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="bankName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bank/Provider Name (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. HDFC Bank, Paytm" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="openingBalance"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{watchType === 'CREDIT_CARD' ? "Current Outstanding (₹)" : "Current Balance (₹)"}</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {watchType === 'CREDIT_CARD' && (
              <>
                <FormField
                  control={form.control}
                  name="creditLimit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Credit Limit (₹)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="network"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Card Network (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Visa, Mastercard, RuPay..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Accent Color</FormLabel>
                  <FormControl>
                    <div className="flex items-center space-x-2">
                      <Input type="color" {...field} className="w-12 h-10 p-1" />
                      <Input type="text" {...field} className="flex-1" />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={addAccount.isPending}>
                {addAccount.isPending ? "Adding..." : "Add Account"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
