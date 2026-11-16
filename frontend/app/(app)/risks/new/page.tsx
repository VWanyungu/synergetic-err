"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Alert, Spinner } from "@/components/auth/auth-ui";
import { ChipGroup, DateField, SegmentGroup, SelectField, TextareaField, TextField } from "@/components/risk-form/fields";
import { useCreateRisk, useRiskFormOptions } from "@/hooks/queries/use-create-risk";
import { useDepartments } from "@/hooks/queries/use-risks";
import { useDivisions } from "@/hooks/queries/use-registers";
import { ApiError } from "@/lib/api-client";

const score = z.number({ error: "Choose a score." }).int().min(1).max(5);
const schema = z.object({
  title: z.string().trim().min(1, "Enter a title for this risk.").max(255),
  description: z.string().max(5000),
  category: z.string().min(1, "Choose a category."),
  departmentId: z.string().min(1, "Choose a department."),
  ownerId: z.string(),
  impact: score,
  likelihood: score,
  riskResponse: z.string(),
  nextReviewDate: z.string(),
  divisionIds: z.array(z.string()),
  actionTitle: z.string().max(255),
  actionOwnerId: z.string(),
  actionDueDate: z.string(),
  actionStatus: z.string(),
});
type Values = z.infer<typeof schema>;

const SCORES = [1, 2, 3, 4, 5].map((n) => ({ value: n, label: String(n) }));
const RESPONSES = ["Accept", "Mitigate", "Transfer", "Avoid"].map((l) => ({ value: l.toLowerCase(), label: l }));
const STATUSES = [
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Done" },
];
const today = new Date().toISOString().slice(0, 10);

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-b border-line py-8 last:border-b-0 md:flex-row md:gap-10">
      <h2 className="w-[200px] shrink-0 text-[11px] font-medium uppercase leading-[1.3] tracking-[0.66px]">{title}</h2>
      <div className="flex min-w-0 flex-1 flex-col gap-5">{children}</div>
    </section>
  );
}

const Row = ({ children }: { children: React.ReactNode }) => <div className="grid gap-4 sm:grid-cols-2">{children}</div>;

/** Same shape as the form, so nothing jumps when the options arrive. */
function FormSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading form">
      {[[56, 120, 56, 56], [40, 40, 56], [34, 34], [120, 56, 40]].map((rows, i) => (
        <Section key={i} title="">
          {rows.map((h, j) => <div key={j} style={{ height: h }} className="animate-pulse rounded-t-sm bg-field" />)}
        </Section>
      ))}
    </div>
  );
}

export default function NewRiskPage() {
  const router = useRouter();
  const options = useRiskFormOptions();
  const departments = useDepartments();
  const create = useCreateRisk();
  const {
    register, control, handleSubmit, setValue, getValues,
    formState: { errors, isSubmitted },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "", description: "", category: "", departmentId: "", ownerId: "", riskResponse: "",
      nextReviewDate: "", divisionIds: [], actionTitle: "", actionOwnerId: "", actionDueDate: "", actionStatus: "not_started",
    },
  });

  // The signed-in user owns the risk unless the form says otherwise.
  const me = options.data?.currentUserId;
  useEffect(() => {
    if (me && !getValues("ownerId")) setValue("ownerId", me);
  }, [me, getValues, setValue]);

  // A Risk Champion's department is fixed to their own.
  const own = options.data?.scopedDepartmentId;
  useEffect(() => {
    if (own) setValue("departmentId", own);
  }, [own, setValue]);

  const departmentId = useWatch({ control, name: "departmentId" });
  const failed = Object.keys(errors).length;
  const names = options.data?.categories.map((c) => ({ id: c, name: c })) ?? [];
  const people = options.data?.owners ?? [];
  const divisions = useDivisions();

  const onSubmit = (v: Values) =>
    create.mutate(
      {
        title: v.title,
        description: v.description,
        category: v.category,
        departmentId: v.departmentId,
        ownerId: v.ownerId || null,
        impact: v.impact,
        likelihood: v.likelihood,
        riskResponse: v.riskResponse || undefined,
        nextReviewDate: v.nextReviewDate || null,
        divisionIds: v.divisionIds,
        action: v.actionTitle.trim()
          ? { title: v.actionTitle.trim(), ownerId: v.actionOwnerId || null, dueDate: v.actionDueDate || null, status: v.actionStatus }
          : null,
      },
      {
        onSuccess: ({ code }) => {
          toast.success(`Risk ${code} created`);
          router.push("/risks");
        },
      },
    );

  const loadError = options.error ?? departments.error ?? divisions.error;

  return (
    <div className="flex w-full flex-col gap-8">
      <header className="flex flex-col gap-2">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 pb-3 text-[14px] leading-normal">
          <Link href="/risks" className="text-brand hover:underline">Risk Register</Link>
          <ChevronRight className="size-3 text-ink-muted" aria-hidden />
          <span className="text-ink-muted">New risk</span>
        </nav>
        <h1 className="text-[24px] font-semibold leading-tight tracking-[-0.48px]">New risk</h1>
      </header>

      {loadError ? (
        <div className="flex flex-col items-start gap-3">
          <Alert variant="error" title="Could not load the form">{loadError.message}</Alert>
          <button type="button" className="btn-secondary btn-auto" onClick={() => { options.refetch(); departments.refetch(); divisions.refetch(); }}>
            Try again
          </button>
        </div>
      ) : options.isPending || departments.isPending || divisions.isPending ? (
        <FormSkeleton />
      ) : (
        <form noValidate onSubmit={handleSubmit(onSubmit)}>
          {isSubmitted && failed > 0 && (
            <Alert variant="error" title={`${failed} ${failed === 1 ? "field needs" : "fields need"} attention`}>
              Fix the highlighted {failed === 1 ? "field" : "fields"}, then create the risk again.
            </Alert>
          )}
          {create.isError && (
            <Alert variant="error" title="Could not create the risk">
              {create.error instanceof ApiError ? create.error.message : "Try again."}
            </Alert>
          )}

          <Section title="Risk details">
            <TextField label="Title *" placeholder="Short name for the risk" error={errors.title?.message} {...register("title")} />
            <TextareaField label="Description" placeholder="What could happen, what causes it, and what it would affect." {...register("description")} />
            <Controller name="category" control={control} render={({ field }) => (
              <SelectField label="Category *" value={field.value} items={names} onChange={field.onChange}
                placeholder="Select a category" emptyText="No categories yet" error={errors.category?.message} />
            )} />
            <Row>
              <Controller name="departmentId" control={control} render={({ field }) => (
                <SelectField label="Department *" value={field.value} items={own ? (departments.data ?? []).filter((d) => d.id === own) : (departments.data ?? [])} onChange={field.onChange}
                  placeholder="Select a department" emptyText="No departments yet" error={errors.departmentId?.message} />
              )} />
              <Controller name="ownerId" control={control} render={({ field }) => (
                <SelectField label="Risk owner" value={field.value} items={people} onChange={field.onChange}
                  placeholder="Unassigned" emptyText="No users yet" />
              )} />
            </Row>
          </Section>

          <Section title="Assessment">
            <Row>
              <Controller name="impact" control={control} render={({ field }) => (
                <SegmentGroup label="Impact" value={field.value} options={SCORES} onChange={field.onChange}
                  ends={["Lowest", "Highest"]} error={errors.impact?.message} />
              )} />
              <Controller name="likelihood" control={control} render={({ field }) => (
                <SegmentGroup label="Likelihood" value={field.value} options={SCORES} onChange={field.onChange}
                  ends={["Rare", "Almost certain"]} error={errors.likelihood?.message} />
              )} />
            </Row>
            <Controller name="riskResponse" control={control} render={({ field }) => (
              <SegmentGroup label="Risk response" value={field.value} options={RESPONSES} onChange={field.onChange} />
            )} />
            <Row>
              <DateField label="Next review date" min={today} {...register("nextReviewDate")} />
            </Row>
          </Section>

          <Section title="Affected divisions">
            <Controller name="divisionIds" control={control} render={({ field }) => (
              <ChipGroup options={divisions.data ?? []} value={field.value} onChange={field.onChange}
                emptyText="No divisions available." />
            )} />
          </Section>

          <Section title="Mitigation plan">
            <TextareaField label="Action" placeholder="Describe the action that reduces this risk." {...register("actionTitle")} />
            <Row>
              <Controller name="actionOwnerId" control={control} render={({ field }) => (
                <SelectField label="Owner" value={field.value} items={people} onChange={field.onChange}
                  placeholder="Select an owner" emptyText="No users yet" />
              )} />
              <DateField label="Due date" min={today} {...register("actionDueDate")} />
            </Row>
            <Controller name="actionStatus" control={control} render={({ field }) => (
              <SegmentGroup label="Status" value={field.value} options={STATUSES} onChange={field.onChange} />
            )} />
          </Section>

          <div className="flex justify-end gap-3 pt-8">
            <Link href="/risks" className="btn-secondary btn-auto">Cancel</Link>
            <button type="submit" disabled={create.isPending} className="btn-primary btn-auto">
              {create.isPending && <Spinner />}
              Create risk
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
