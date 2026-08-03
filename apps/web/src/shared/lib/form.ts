import { zodResolver } from '@hookform/resolvers/zod';
import {
  useForm,
  type FieldValues,
  type UseFormProps,
  type UseFormReturn,
} from 'react-hook-form';
import type { z } from 'zod';

/** React Hook Form + Zod listo para features (sin pantallas aún). */
export function useZodForm<TSchema extends z.ZodType<FieldValues>>(
  schema: TSchema,
  options?: Omit<UseFormProps<z.infer<TSchema>>, 'resolver'>,
): UseFormReturn<z.infer<TSchema>> {
  return useForm<z.infer<TSchema>>({
    ...options,
    resolver: zodResolver(schema),
  });
}

export { zodResolver };
