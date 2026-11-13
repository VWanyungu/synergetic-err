import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export interface Me {
  firstName: string;
  lastName: string;
  email: string;
  createdAt: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  departmentId: string | null;
  department: string | null;
  roles: { role: string; since: string; grantedBy: string | null }[];
}

export const useMe = () => useQuery({ queryKey: ["me"], queryFn: () => api<Me>("/me") });

/** Profile pictures by full name, for the people who have one. */
export const useAvatars = () => useQuery({ queryKey: ["avatars"], queryFn: () => api<Record<string, string>>("/avatars"), staleTime: 5 * 60_000 });

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export const useUploadProfileImage = (kind: "avatar" | "banner") => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) =>
      new Promise<{ url: string }>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("Could not read the file."));
        reader.onload = () => api<{ url: string }>(`/me/${kind}`, { method: "PUT", body: { name: file.name, mimeType: file.type, data: reader.result } }).then(resolve, reject);
        reader.readAsDataURL(file);
      }),
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: ["me"] }), qc.invalidateQueries({ queryKey: ["avatars"] })]),
  });
};
