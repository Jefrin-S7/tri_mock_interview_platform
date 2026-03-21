import react from "react";
import { FormControl, FormDescription, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Controller, FieldValues, Path, Control} from "react-hook-form";

interface FormFieldProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  label: string;
  placeholder?: string;
  type?: 'text' | 'email' | 'password' | 'file' | 'number';

}

const FormField = <T extends FieldValues>({ control, name, label, placeholder, type ="text" }: FormFieldProps<T>) => {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => {
        const fieldProps = { ...field } as any;

        if (type === 'number') {
          fieldProps.onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const value = e.target.value;
            field.onChange(value === '' ? '' : Number(value));
          };
          fieldProps.value = field.value ?? '';
        }

        return (
          <FormItem>
            <FormLabel className="label">{label}</FormLabel>
            <FormControl>
              <Input className="input" placeholder={placeholder} type={type} {...fieldProps} />
            </FormControl>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
};

export default FormField