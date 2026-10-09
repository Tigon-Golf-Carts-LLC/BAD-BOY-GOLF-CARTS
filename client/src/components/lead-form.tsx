import { useEffect, useRef, useState, type FormEvent } from "react";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { PHONE_NUMBER, PHONE_TEL } from "@/lib/constants";
import {
  HONEYPOT_NAME,
  IMAGE_ACCEPT,
  TIGON_FORM_NAME,
  captureFirstTouch,
  checkImage,
  digitsOnly,
  isValidEmail,
  sendLead,
  trackingFields,
} from "@/lib/tigon-lead";

/** Cart the visitor is asking about; locks brand/model/VIN/SKU on the form. */
export interface LeadCart {
  brand?: string;
  model?: string;
  vin?: string;
  sku?: string;
}

interface LeadFormProps {
  /** Used to keep input ids unique when more than one form is on a page. */
  idPrefix: string;
  cart?: LeadCart;
  defaultComments?: string;
  submitLabel?: string;
  onSuccess?: () => void;
}

const SUCCESS_TEXT = "Thank you! We received your message and will contact you shortly.";
const TRACKING_NAMES = [
  "url",
  "referrer",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid",
  "ga_client_id",
];
const IMAGE_NAMES = ["image_1", "image_2", "image_3"];

type Errors = Record<string, string>;

function validate(form: HTMLFormElement): Errors {
  const fd = new FormData(form);
  const val = (k: string) => String(fd.get(k) || "").trim();
  const errors: Errors = {};

  if (!val("first_name")) errors.first_name = "Please enter your first name.";
  if (!val("last_name")) errors.last_name = "Please enter your last name.";
  if (!val("email")) errors.email = "Please enter your email.";
  else if (!isValidEmail(val("email"))) errors.email = "Please enter a valid email address.";
  if (!val("phone1")) errors.phone1 = "Please enter your phone number.";
  else if (digitsOnly(val("phone1")).length < 10) errors.phone1 = "Phone number must have at least 10 digits.";
  if (val("phone2") && digitsOnly(val("phone2")).length < 10) {
    errors.phone2 = "Alternate phone must have at least 10 digits.";
  }
  if (val("zip_code") && !/^\d{5}(-?\d{4})?$/.test(val("zip_code"))) {
    errors.zip_code = "Please enter a valid 5-digit ZIP code.";
  }
  for (const name of IMAGE_NAMES) {
    const input = form.elements.namedItem(name) as HTMLInputElement | null;
    const msg = checkImage(input?.files?.[0]);
    if (msg) errors[name] = msg;
  }
  return errors;
}

export function LeadForm({ idPrefix, cart, defaultComments, submitLabel = "Send Message", onSuccess }: LeadFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const id = (name: string) => `${idPrefix}-${name}`;
  const locked = !!cart;

  // Fill hidden tracking inputs on load (and remember first-touch UTMs).
  const fillHidden = () => {
    const form = formRef.current;
    if (!form) return;
    const t = trackingFields();
    for (const [k, v] of Object.entries(t)) {
      const el = form.elements.namedItem(k) as HTMLInputElement | null;
      if (el) el.value = v;
    }
  };

  useEffect(() => {
    captureFirstTouch();
    fillHidden();
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (sending) return;

    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length) {
      setStatus({ ok: false, text: "Please fix the highlighted fields." });
      const first = form.querySelector<HTMLElement>(`#${CSS.escape(id(Object.keys(found)[0]))}`);
      first?.focus();
      return;
    }

    fillHidden();
    setSending(true);
    setStatus({ ok: true, text: "Sending…" });
    try {
      await sendLead(form);
      form.reset();
      fillHidden();
      setSent(true);
      setStatus({ ok: true, text: SUCCESS_TEXT });
      onSuccess?.();
    } catch (err) {
      setStatus({ ok: false, text: (err as Error).message });
    } finally {
      setSending(false);
    }
  }

  const fieldError = (name: string) =>
    errors[name] ? (
      <p id={id(`${name}-error`)} className="text-xs font-medium text-destructive">
        {errors[name]}
      </p>
    ) : null;

  const a11y = (name: string) => ({
    id: id(name),
    name,
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] ? id(`${name}-error`) : undefined,
    className: cn(errors[name] && "border-destructive"),
  });

  if (sent) {
    return (
      <div className="flex flex-col items-center text-center gap-3 py-8" role="status" aria-live="polite" data-testid="lead-form-success">
        <CheckCircle2 className="h-12 w-12 text-primary" />
        <p className="text-lg font-semibold">{SUCCESS_TEXT}</p>
        <p className="text-sm text-muted-foreground">
          Need an answer right away? Call{" "}
          <a href={PHONE_TEL} className="text-primary font-semibold hover:underline">
            {PHONE_NUMBER}
          </a>
          .
        </p>
        <Button
          variant="outline"
          onClick={() => {
            setSent(false);
            setStatus(null);
          }}
        >
          Send another message
        </Button>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      onInput={(e) => {
        const name = (e.target as HTMLInputElement).name;
        if (errors[name]) setErrors(({ [name]: _, ...rest }) => rest);
      }}
      method="post"
      encType="multipart/form-data"
      noValidate
      className="relative space-y-4"
      data-testid="lead-form"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor={id("first_name")}>First name *</Label>
          <Input type="text" autoComplete="given-name" required {...a11y("first_name")} />
          {fieldError("first_name")}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={id("last_name")}>Last name *</Label>
          <Input type="text" autoComplete="family-name" required {...a11y("last_name")} />
          {fieldError("last_name")}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={id("email")}>Email *</Label>
          <Input type="email" autoComplete="email" required {...a11y("email")} />
          {fieldError("email")}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={id("phone1")}>Phone *</Label>
          <Input type="tel" autoComplete="tel" required {...a11y("phone1")} />
          {fieldError("phone1")}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={id("phone2")}>Alternate phone</Label>
          <Input type="tel" {...a11y("phone2")} />
          {fieldError("phone2")}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={id("zip_code")}>ZIP code</Label>
          <Input type="text" inputMode="numeric" autoComplete="postal-code" {...a11y("zip_code")} />
          {fieldError("zip_code")}
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor={id("address")}>Address</Label>
          <Input type="text" autoComplete="street-address" {...a11y("address")} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={id("brand")}>Brand</Label>
          <Input
            type="text"
            placeholder={locked ? undefined : "e.g. Denago, Evolution, Club Car"}
            defaultValue={cart?.brand || ""}
            readOnly={locked}
            {...a11y("brand")}
            className={cn(locked && "bg-muted")}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={id("model")}>Model</Label>
          <Input
            type="text"
            placeholder={locked ? undefined : "Model you are interested in"}
            defaultValue={cart?.model || ""}
            readOnly={locked}
            {...a11y("model")}
            className={cn(locked && "bg-muted")}
          />
        </div>
        {locked ? (
          <>
            {/* Cart pages: VIN / stock # come from the cart and can't be edited. */}
            <input type="hidden" name="vin_number" value={cart?.vin || ""} />
            <input type="hidden" name="sku_number" value={cart?.sku || ""} />
            {(cart?.vin || cart?.sku) && (
              <p className="sm:col-span-2 text-xs text-muted-foreground -mt-2">
                {cart?.vin && <>VIN: {cart.vin}</>}
                {cart?.vin && cart?.sku && " · "}
                {cart?.sku && <>Stock # / SKU: {cart.sku}</>}
              </p>
            )}
          </>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label htmlFor={id("vin_number")}>VIN (optional)</Label>
              <Input type="text" {...a11y("vin_number")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={id("sku_number")}>Stock # / SKU (optional)</Label>
              <Input type="text" {...a11y("sku_number")} />
            </div>
          </>
        )}

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor={id("comments")}>Message</Label>
          <Textarea rows={4} placeholder="How can we help?" defaultValue={defaultComments} {...a11y("comments")} />
        </div>

        {IMAGE_NAMES.map((name, i) => (
          <div key={name} className="space-y-1.5 sm:col-span-2">
            <Label htmlFor={id(name)}>Photo {i + 1} (optional)</Label>
            <Input type="file" accept={IMAGE_ACCEPT} {...a11y(name)} className={cn("cursor-pointer", errors[name] && "border-destructive")} />
            {fieldError(name)}
          </div>
        ))}
        <p className="sm:col-span-2 text-xs text-muted-foreground -mt-2">
          Photos: JPG, PNG, GIF, WEBP or HEIC, up to 10 MB each.
        </p>
      </div>

      {/* Spam trap: real visitors never see this. Leave it empty. Do not remove. */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", top: "auto", width: 1, height: 1, overflow: "hidden" }}>
        <label htmlFor={id("hp")}>Leave this field empty</label>
        <input type="text" name={HONEYPOT_NAME} id={id("hp")} tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>

      {/* Filled in automatically right before sending. */}
      <input type="hidden" name="form_name" value={TIGON_FORM_NAME} />
      {TRACKING_NAMES.map((name) => (
        <input key={name} type="hidden" name={name} defaultValue="" />
      ))}

      <Button type="submit" size="lg" className="w-full redline-glow" disabled={sending} data-testid="button-lead-submit">
        {sending ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <Send className="h-5 w-5 mr-2" />}
        {sending ? "Sending…" : submitLabel}
      </Button>
      <p
        role="status"
        aria-live="polite"
        className={cn("text-sm font-semibold min-h-[1.25rem]", status?.ok ? "text-primary" : "text-destructive")}
        data-testid="lead-form-status"
      >
        {status?.text}
      </p>
    </form>
  );
}
