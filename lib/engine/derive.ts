import type { DerivedFacts, JsonValue, ProposedAction } from "../schemas";

export interface DerivationContext {
  trustedDomains?: readonly string[];
  customerDataAttachmentNames?: readonly string[];
}

function strings(value: JsonValue | undefined): string[] {
  if (typeof value === "string") return [value];
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

function emailDomain(address: string): string | null {
  const match = address.toLowerCase().match(/@([^>\s,;]+)$/);
  return match?.[1] ?? null;
}

function attachmentDetails(value: JsonValue | undefined): {
  names: string[];
  dataClasses: string[];
} {
  if (!Array.isArray(value)) return { names: [], dataClasses: [] };

  const names: string[] = [];
  const dataClasses: string[] = [];
  for (const attachment of value) {
    if (typeof attachment === "string") {
      names.push(attachment);
      continue;
    }
    if (attachment && !Array.isArray(attachment) && typeof attachment === "object") {
      if (typeof attachment.name === "string") names.push(attachment.name);
      dataClasses.push(...strings(attachment.data_classes));
    }
  }
  return { names, dataClasses };
}

export function deriveFacts(
  action: ProposedAction,
  context: DerivationContext = {},
): DerivedFacts {
  const recipients = ["recipients", "to", "cc", "bcc"].flatMap((key) =>
    strings(action.args[key]),
  );
  const uniqueRecipients = [...new Set(recipients.map((recipient) => recipient.toLowerCase()))];
  const trustedDomains = new Set((context.trustedDomains ?? []).map((domain) => domain.toLowerCase()));
  const externalDomains = [
    ...new Set(
      uniqueRecipients
        .map(emailDomain)
        .filter((domain): domain is string => domain !== null && !trustedDomains.has(domain)),
    ),
  ].sort();

  const attachments = attachmentDetails(action.args.attachments);
  const dataClasses = [
    ...new Set([...strings(action.args.data_classes), ...attachments.dataClasses]),
  ].sort();
  const knownCustomerAttachments = new Set(
    (context.customerDataAttachmentNames ?? []).map((name) => name.toLowerCase()),
  );
  const containsCustomerData =
    dataClasses.some((dataClass) =>
      ["customer", "customer_data", "customer_email", "pii"].includes(dataClass.toLowerCase()),
    ) || attachments.names.some((name) => knownCustomerAttachments.has(name.toLowerCase()));

  return {
    recipient_count: uniqueRecipients.length,
    external_domains: externalDomains,
    contains_customer_data: containsCustomerData,
    data_classes: dataClasses,
    attachment_names: [...new Set(attachments.names)].sort(),
  };
}
