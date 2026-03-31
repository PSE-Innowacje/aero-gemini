import type { QueryClient, QueryKey } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/lib/errors';

type BuildMutationOptionsArgs = {
  queryClient: QueryClient;
  invalidateQueryKey: QueryKey;
  successTitle: string;
  errorTitle?: string;
  onSuccess?: () => void;
};

export const buildMutationOptions = ({
  queryClient,
  invalidateQueryKey,
  successTitle,
  errorTitle = 'Błąd operacji',
  onSuccess,
}: BuildMutationOptionsArgs) => ({
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: invalidateQueryKey });
    onSuccess?.();
    toast({ title: successTitle });
  },
  onError: (error: unknown) => {
    toast({
      title: errorTitle,
      description: getErrorMessage(error),
      variant: 'destructive',
    });
  },
});
