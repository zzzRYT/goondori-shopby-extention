import type { FillField, FillResult } from '../messaging';

export type FieldMap = Record<string, string>;
export type FillableElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

export function setFieldValue(element: FillableElement, value: string) {
  if (element instanceof HTMLSelectElement) {
    element.value = value;
  } else {
    setNativeValue(element, value);
  }

  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

export function fillByMap(doc: Document, fieldMap: FieldMap, fields: FillField[]): FillResult {
  const result: FillResult = { filled: [], failed: [] };

  for (const field of fields) {
    const selector = fieldMap[field.key];
    if (!selector) {
      result.failed.push({ key: field.key, reason: 'selector not configured' });
      continue;
    }

    const element = doc.querySelector(selector);
    if (!element) {
      result.failed.push({ key: field.key, reason: `selector not found: ${selector}` });
      continue;
    }

    if (!isFillableElement(element)) {
      result.failed.push({ key: field.key, reason: `element is not fillable: ${selector}` });
      continue;
    }

    setFieldValue(element, field.value);
    result.filled.push({ key: field.key });
  }

  return result;
}

function setNativeValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;

  if (!setter) {
    element.value = value;
    return;
  }

  setter.call(element, value);
}

function isFillableElement(element: Element): element is FillableElement {
  return (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement
  );
}
