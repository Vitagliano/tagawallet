"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useSWRConfig } from "swr";
import Link from "next/link";
import { CHAIN_IDS, CHAINS, inferFamily, chainsInFamily } from "@tagawallet/shared";
import { api, ClientError } from "@/lib/client";
import { Button, ErrorNote, Field, Input, Select } from "./ui";
import { parseTags } from "./link-editor";

type Values = { address: string; chain: string; displayLabel: string; tags: string; listId: string };

export function QuickAddWallet({ lists, listId, onDone }: { lists?: { id: string; name: string }[]; listId?: string; onDone?: () => void }) {
  const { register, handleSubmit, setError, setValue, reset, formState: { errors, isSubmitting } } = useForm<Values>({
    defaultValues: { chain: "ethereum", address: "", displayLabel: "", tags: "", listId: listId ?? lists?.[0]?.id ?? "" },
  });
  const { mutate } = useSWRConfig();
  const [problem, setProblem] = useState<string | null>(null);
  const [duplicateId, setDuplicateId] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  async function submit(v: Values) {
    setProblem(null); setDuplicateId(null); setSaved(null);
    try {
      const res = await api("/api/wallets", { body: { address: v.address, chain: v.chain, displayLabel: v.displayLabel, tags: parseTags(v.tags), listId: listId ?? (v.listId || undefined) } });
      reset({ ...v, address: "", displayLabel: "", tags: "" });
      setSaved(res.existing ? "You already had this wallet, so it was added to the list as it was." : "Saved.");
      mutate((k) => typeof k === "string" && k.startsWith("/api/"));
      onDone?.();
    } catch (err) {
      if (!(err instanceof ClientError)) throw err;
      if (err.data.duplicate) setDuplicateId(err.data.walletId);
      const fields = err.data.fields as Record<string, string> | undefined;
      if (fields?.address) setError("address", { message: fields.address });
      else setProblem(err.message);
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-3" noValidate>
      <Field label="Address" error={errors.address?.message}>
        <Input
          className="addr" placeholder="0x…, Solana or Bitcoin address" autoComplete="off" spellCheck={false}
          aria-invalid={!!errors.address}
          {...register("address", {
            onChange: (e) => {
              const family = inferFamily(e.target.value.trim());
              if (family && family !== "evm") setValue("chain", chainsInFamily(family)[0]!);
            },
          })}
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Chain">
          <Select {...register("chain")}>
            {CHAIN_IDS.map((c) => <option key={c} value={c}>{CHAINS[c].name}</option>)}
          </Select>
        </Field>
        <Field label="Name"><Input placeholder="Alice's trading wallet" {...register("displayLabel")} /></Field>
      </div>
      <div className={`grid gap-3 ${listId ? "" : "sm:grid-cols-2"}`}>
        <Field label="Tags" hint="Separate with commas"><Input placeholder="trader, watchlist" {...register("tags")} /></Field>
        {!listId && (
          <Field label="List">
            <Select {...register("listId")}>
              <option value="">No list</option>
              {lists?.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </Select>
          </Field>
        )}
      </div>
      {problem && <ErrorNote>{problem}{duplicateId && <> <Link className="underline" href={`/wallets/${duplicateId}`}>Open it</Link></>}</ErrorNote>}
      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" disabled={isSubmitting}>{isSubmitting ? "Saving…" : "Save wallet"}</Button>
        {saved && <span role="status" className="text-sm text-good">{saved}</span>}
      </div>
    </form>
  );
}
