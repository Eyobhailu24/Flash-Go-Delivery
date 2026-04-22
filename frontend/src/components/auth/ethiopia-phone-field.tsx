"use client";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { sanitizeEthiopiaNationalInput } from "@/lib/ethiopia-phone";
import { cn } from "@/lib/utils";

type EthiopiaPhoneFieldProps = {
  id: string;
  label: string;
  name?: string;
  value: string;
  onNationalChange: (digits: string) => void;
  disabled?: boolean;
  required?: boolean;
};

export function EthiopiaPhoneField({
  id,
  label,
  name,
  value,
  onNationalChange,
  disabled,
  required,
}: EthiopiaPhoneFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <InputGroup className={cn("h-11 min-h-11")}>
        <InputGroupAddon>
          <InputGroupText className="font-medium text-foreground">
            +251
          </InputGroupText>
        </InputGroupAddon>
        <InputGroupInput
          id={id}
          name={name}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder=""
          maxLength={9}
          value={value}
          disabled={disabled}
          required={required}
          onChange={(e) =>
            onNationalChange(sanitizeEthiopiaNationalInput(e.target.value))
          }
        />
      </InputGroup>
    </div>
  );
}
