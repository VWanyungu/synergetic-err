"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { RegisterPage } from "@/components/risk-register/register-page";

export default function DepartmentRegisterPage() {
  const { id } = useParams<{ id: string }>();
  // The register reads the query string, which needs a Suspense boundary.
  return (
    <Suspense>
      <RegisterPage mode="department" id={id} />
    </Suspense>
  );
}
