import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import type { DossierText, Entity, FeedbackInput, Scan, ScanInput } from './types';

export const queryKeys = {
  scan: (id: string) => ['scan', id] as const,
  history: ['history'] as const,
};

/** Polls while the check is still running, then stops. */
export function useScan(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.scan(id ?? ''),
    queryFn: () => api.getScan(id as string),
    enabled: Boolean(id),
    retry: false,
    refetchOnWindowFocus: false,
    refetchInterval: (query) => (query.state.data?.status === 'processing' ? 700 : false),
  });
}

export function useHistory() {
  return useQuery({ queryKey: queryKeys.history, queryFn: () => api.listHistory() });
}

export function useCreateScan() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: ScanInput) => api.createScan(input),
    onSuccess: (scan) => {
      client.setQueryData(queryKeys.scan(scan.id), scan);
      void client.invalidateQueries({ queryKey: queryKeys.history });
    },
  });
}

export function useConfirmEntities(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (entities: Entity[]) => api.confirmEntities(id, entities),
    onSuccess: (scan: Scan) => client.setQueryData(queryKeys.scan(id), scan),
  });
}

export function useCreateDossier(id: string) {
  return useMutation({ mutationFn: (text: DossierText) => api.createDossier(id, text) });
}

export function useDeleteScan() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteScan(id),
    onSuccess: (_void, id) => {
      client.removeQueries({ queryKey: queryKeys.scan(id) });
      void client.invalidateQueries({ queryKey: queryKeys.history });
    },
  });
}

export function useDeleteAllScans() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api.deleteAllScans(),
    onSuccess: () => {
      client.removeQueries({ queryKey: ['scan'] });
      void client.invalidateQueries({ queryKey: queryKeys.history });
    },
  });
}

export function useSendFeedback() {
  return useMutation({ mutationFn: (input: FeedbackInput) => api.sendFeedback(input) });
}
