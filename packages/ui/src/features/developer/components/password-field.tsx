import { FieldError, Input, Label, TextField } from '@heroui/react'

type PasswordFieldProps = {
  label: string
  value: string
  error?: string | undefined
  isReadOnly: boolean
  autoFocus?: boolean
  onChange: (value: string) => void
}

/** A password typed for a .p12, with why it can't be used yet under it. */
export const PasswordField = ({
  label,
  value,
  error,
  isReadOnly,
  autoFocus = false,
  onChange
}: PasswordFieldProps) => (
  <TextField
    type="password"
    value={value}
    onChange={onChange}
    isInvalid={error !== undefined}
    isReadOnly={isReadOnly}
    autoFocus={autoFocus}
  >
    <Label>{label}</Label>
    <Input autoComplete="new-password" />
    {error ? <FieldError>{error}</FieldError> : null}
  </TextField>
)
