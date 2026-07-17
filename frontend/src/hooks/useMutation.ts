import { useState, useCallback, useRef, useEffect } from 'react';

export interface MutationOptions<TResult, TArgs extends any[]> {
  onSuccess?: (result: TResult, ...args: TArgs) => void;
  onError?: (error: any, ...args: TArgs) => void;
  successMessage?: string | ((result: TResult, ...args: TArgs) => string);
  errorMessage?: string | ((error: any, ...args: TArgs) => string);
  refetch?: () => void;
  addToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export function useMutation<TResult, TArgs extends any[]>(
  mutationFn: (...args: TArgs) => Promise<TResult>,
  options: MutationOptions<TResult, TArgs> = {}
) {
  const [isLoading, setIsLoading] = useState(false);
  const optionsRef = useRef(options);

  useEffect(() => {
    optionsRef.current = options;
  });

  const execute = useCallback(
    async (...args: TArgs) => {
      setIsLoading(true);
      try {
        const result = await mutationFn(...args);
        const currentOptions = optionsRef.current;
        
        currentOptions.refetch?.();
        
        if (currentOptions.successMessage && currentOptions.addToast) {
          const msg = typeof currentOptions.successMessage === 'function' 
            ? currentOptions.successMessage(result, ...args) 
            : currentOptions.successMessage;
          currentOptions.addToast(msg, 'success');
        }
        
        currentOptions.onSuccess?.(result, ...args);
        return result;
      } catch (err) {
        const currentOptions = optionsRef.current;
        
        if (currentOptions.errorMessage && currentOptions.addToast) {
          const msg = typeof currentOptions.errorMessage === 'function' 
            ? currentOptions.errorMessage(err, ...args) 
            : currentOptions.errorMessage;
          currentOptions.addToast(msg, 'error');
        }
        
        currentOptions.onError?.(err, ...args);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [mutationFn]
  );

  return { execute, isLoading };
}
