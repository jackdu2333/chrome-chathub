import type {
  AdapterAction,
  InputMethod,
  SelectorLocator,
  SelectorSpec,
  ServiceAdapter,
  SubmitMode,
  SubmitVerificationMode,
  UploadStrategy,
  UserMessagePayload,
} from '../../types';
import { DriverExecutionError, type DriverExecutionContext } from '../drivers/types';

type QueryRoot = Document | Element | ShadowRoot;

export type FileUploadStrategy = UploadStrategy;

export interface FlowExecutionOptions {
  inputSelector?: SelectorSpec;
  submitSelector?: SelectorSpec;
  submitMode?: SubmitMode;
  submitVerificationMode?: SubmitVerificationMode;
  uploadStrategy?: FileUploadStrategy;
  prefillDelayRange?: [number, number];
  beforeSubmitDelayRange?: [number, number];
  postUploadDelayRange?: [number, number];
  waitForInputTimeoutMs?: number;
  waitForSubmitTimeoutMs?: number;
}

export function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export function randomDelay(min: number, max: number): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return sleep(delay);
}

export async function waitForCondition(
  predicate: () => boolean,
  options?: {
    timeoutMs?: number;
    intervalMs?: number;
  }
) {
  const timeoutMs = options?.timeoutMs ?? 5000;
  const intervalMs = options?.intervalMs ?? 150;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (predicate()) {
      return true;
    }
    await sleep(intervalMs);
  }

  return false;
}

function isSelectorLocator(candidate: string | SelectorLocator): candidate is SelectorLocator {
  return typeof candidate === 'object' && candidate !== null && 'selector' in candidate;
}

export function normalizeSelectorSpec(selector?: SelectorSpec): SelectorLocator[] {
  if (!selector) {
    return [];
  }

  const candidates = Array.isArray(selector) ? selector : [selector];
  return candidates.flatMap((candidate) => {
    if (typeof candidate === 'string') {
      return candidate.trim() ? [{ selector: candidate.trim() }] : [];
    }

    if (isSelectorLocator(candidate) && candidate.selector.trim()) {
      return [{
        ...candidate,
        selector: candidate.selector.trim(),
      }];
    }

    return [];
  });
}

export function selectorSpecToDebugString(selector?: SelectorSpec): string {
  const normalized = normalizeSelectorSpec(selector);
  if (!normalized.length) {
    return '<empty>';
  }

  return normalized
    .map((candidate) => {
      const scope: string = candidate.rootSelector
        ? ` @ ${selectorSpecToDebugString(candidate.rootSelector)}`
        : '';
      const shadow = candidate.inShadowDom ? ' [shadow]' : '';
      return `${candidate.selector}${scope}${shadow}`;
    })
    .join(' | ');
}

export function hasSelectorSpec(selector?: SelectorSpec) {
  return normalizeSelectorSpec(selector).length > 0;
}

function resolveCandidateRoot(candidate: SelectorLocator, fallbackRoot: QueryRoot): QueryRoot | null {
  let root: QueryRoot = fallbackRoot;

  if (candidate.rootSelector) {
    const scopedRoot = querySelectorBySpec(candidate.rootSelector, {
      root: fallbackRoot,
      visible: false,
    });
    if (!scopedRoot) {
      return null;
    }
    root = scopedRoot;
  }

  const shadowTargetSpec = candidate.shadowRootSelector;
  if (shadowTargetSpec) {
    const shadowHost = querySelectorBySpec(shadowTargetSpec, {
      root: fallbackRoot,
      visible: false,
    });
    if (!shadowHost?.shadowRoot) {
      return null;
    }
    root = shadowHost.shadowRoot;
  } else if (candidate.inShadowDom) {
    if (root instanceof ShadowRoot) {
      return root;
    }

    if (root instanceof Element && root.shadowRoot) {
      root = root.shadowRoot;
    } else {
      return null;
    }
  }

  return root;
}

export function querySelectorBySpec(
  selector: SelectorSpec,
  options?: {
    root?: QueryRoot;
    visible?: boolean;
  }
): HTMLElement | null {
  const root = options?.root ?? document;

  for (const candidate of normalizeSelectorSpec(selector)) {
    const candidateRoot = resolveCandidateRoot(candidate, root);
    if (!candidateRoot) {
      continue;
    }

    const element = candidateRoot.querySelector(candidate.selector) as HTMLElement | null;
    if (element && (!options?.visible || isElementVisible(element))) {
      return element;
    }
  }

  return null;
}

export function queryAllBySpec(
  selector: SelectorSpec,
  options?: {
    root?: QueryRoot;
    visible?: boolean;
  }
) {
  const root = options?.root ?? document;
  const results: HTMLElement[] = [];

  for (const candidate of normalizeSelectorSpec(selector)) {
    const candidateRoot = resolveCandidateRoot(candidate, root);
    if (!candidateRoot) {
      continue;
    }

    const elements = Array.from(candidateRoot.querySelectorAll(candidate.selector)) as HTMLElement[];
    results.push(
      ...elements.filter((element) => !options?.visible || isElementVisible(element))
    );
  }

  return results;
}

export async function waitForElement(
  selector: SelectorSpec,
  options?: {
    timeoutMs?: number;
    intervalMs?: number;
    root?: QueryRoot;
    visible?: boolean;
  }
): Promise<HTMLElement> {
  const timeoutMs = options?.timeoutMs ?? 6000;
  const intervalMs = options?.intervalMs ?? 200;
  const root = options?.root ?? document;
  const startedAt = Date.now();
  const debugSelector = selectorSpecToDebugString(selector);

  while (Date.now() - startedAt < timeoutMs) {
    const element = querySelectorBySpec(selector, { root, visible: options?.visible });
    if (element) {
      return element;
    }
    await sleep(intervalMs);
  }

  throw new Error(`ELEMENT_NOT_FOUND:${debugSelector}`);
}

export function isElementVisible(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

export function isElementDisabled(element: HTMLElement) {
  return (
    element.hasAttribute('disabled') ||
    element.getAttribute('aria-disabled') === 'true' ||
    element.classList.contains('disabled') ||
    (element as HTMLButtonElement).disabled === true
  );
}

export async function waitForElementEnabled(
  selector: SelectorSpec,
  options?: {
    timeoutMs?: number;
    intervalMs?: number;
  }
) {
  const timeoutMs = options?.timeoutMs ?? 6000;
  const intervalMs = options?.intervalMs ?? 200;
  const startedAt = Date.now();
  const debugSelector = selectorSpecToDebugString(selector);

  while (Date.now() - startedAt < timeoutMs) {
    const element = querySelectorBySpec(selector, { visible: false });
    if (element && !isElementDisabled(element)) {
      return element;
    }
    await sleep(intervalMs);
  }

  throw new Error(`SUBMIT_NOT_ENABLED:${debugSelector}`);
}

export function clickElement(element: HTMLElement) {
  const mouseOptions = { bubbles: true, cancelable: true, view: window };
  element.dispatchEvent(new MouseEvent('mousedown', mouseOptions));
  element.dispatchEvent(new MouseEvent('mouseup', mouseOptions));
  element.click();
}

export async function simulateEnterKey(element: HTMLElement) {
  element.focus();
  await sleep(50);

  const eventOptions = {
    key: 'Enter',
    code: 'Enter',
    keyCode: 13,
    which: 13,
    bubbles: true,
    cancelable: true,
    composed: true,
    view: window,
  };

  element.dispatchEvent(new KeyboardEvent('keydown', eventOptions));
  await randomDelay(15, 35);
  element.dispatchEvent(new KeyboardEvent('keypress', eventOptions));
  await randomDelay(15, 35);
  element.dispatchEvent(new KeyboardEvent('keyup', eventOptions));
}

export async function setTextOnElement(element: HTMLElement, value: string) {
  if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
    const input = element as HTMLInputElement | HTMLTextAreaElement;
    const lastValue = input.value;

    if (element.tagName === 'TEXTAREA') {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        'value'
      )?.set;
      if (nativeSetter) {
        nativeSetter.call(input, value);
      } else {
        input.value = value;
      }
    } else {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      )?.set;
      if (nativeSetter) {
        nativeSetter.call(input, value);
      } else {
        input.value = value;
      }
    }

    input.focus();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', code: 'KeyA', bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'a', code: 'KeyA', bubbles: true }));
    input.dispatchEvent(
      new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value })
    );
    input.dispatchEvent(new Event('change', { bubbles: true }));

    const tracker = (input as { _valueTracker?: { setValue: (next: string) => void } })._valueTracker;
    if (tracker) {
      tracker.setValue(lastValue);
    }

    if (!input.value.includes(value.trim())) {
      throw new Error('TEXT_NOT_APPLIED');
    }
    return;
  }

  const editableElement = resolveEditableElement(element);
  editableElement.focus();

  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(editableElement);
  selection?.removeAllRanges();
  selection?.addRange(range);

  const success = document.execCommand('insertText', false, value);
  if (!success) {
    const dataTransfer = new DataTransfer();
    dataTransfer.setData('text/plain', value);
    const pasteEvent = new ClipboardEvent('paste', {
      clipboardData: dataTransfer,
      bubbles: true,
      cancelable: true,
      composed: true,
    });
    editableElement.dispatchEvent(pasteEvent);
    await sleep(50);

    if (!getElementTextSnapshot(editableElement).includes(value.trim())) {
      if (editableElement.querySelector('p')) {
        const p = editableElement.querySelector('p');
        if (p) {
          p.textContent = value;
        }
      } else {
        editableElement.textContent = value;
      }
    }
  }

  editableElement.dispatchEvent(
    new InputEvent('input', {
      bubbles: true,
      inputType: 'insertText',
      data: value,
    })
  );
  editableElement.dispatchEvent(new Event('change', { bubbles: true }));

  if (!getElementTextSnapshot(editableElement).includes(value.trim())) {
    throw new Error('TEXT_NOT_APPLIED');
  }
}

export async function applyInputMethod(
  element: HTMLElement,
  value: string,
  inputMethod: InputMethod = 'default'
) {
  if (inputMethod === 'default') {
    await setTextOnElement(element, value);
    return;
  }

  if (inputMethod === 'text') {
    const editable = resolveEditableElement(element);
    editable.focus();
    editable.innerText = value;
    editable.dispatchEvent(new Event('input', { bubbles: true }));
    editable.dispatchEvent(new Event('change', { bubbles: true }));
    if (!getElementTextSnapshot(editable).includes(value.trim())) {
      throw new Error('TEXT_NOT_APPLIED');
    }
    return;
  }

  if (inputMethod === 'input') {
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      element.focus();
      element.value = value;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      if (!element.value.includes(value.trim())) {
        throw new Error('TEXT_NOT_APPLIED');
      }
      return;
    }

    await setTextOnElement(element, value);
    return;
  }

  if (inputMethod === 'paste' || inputMethod === 'pasteAndText') {
    const editable = resolveEditableElement(element);
    const transfer = new DataTransfer();
    transfer.setData('text/plain', value);
    editable.focus();
    editable.dispatchEvent(
      new ClipboardEvent('paste', {
        clipboardData: transfer,
        bubbles: true,
        cancelable: true,
        composed: true,
      })
    );
    await sleep(100);
    editable.dispatchEvent(
      new InputEvent('input', {
        bubbles: true,
        inputType: 'insertFromPaste',
        data: value,
      })
    );
    editable.dispatchEvent(new Event('change', { bubbles: true }));

    if (inputMethod === 'pasteAndText' && !getElementTextSnapshot(editable).includes(value.trim())) {
      editable.innerText = value;
      editable.dispatchEvent(new Event('input', { bubbles: true }));
    }

    if (!getElementTextSnapshot(editable).includes(value.trim())) {
      throw new Error('TEXT_NOT_APPLIED');
    }
    return;
  }

  await setTextOnElement(element, value);
}

export function resolveEditableElement(element: HTMLElement) {
  if (element.isContentEditable) {
    return element;
  }

  const nestedEditable = element.querySelector('[contenteditable="true"]') as HTMLElement | null;
  return nestedEditable ?? element;
}

export function getElementTextSnapshot(element: HTMLElement) {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    return element.value;
  }

  return (element.innerText || element.textContent || '').trim();
}

export async function uploadFiles(
  targetElement: HTMLElement,
  files: NonNullable<UserMessagePayload['files']>,
  strategy: FileUploadStrategy = 'paste-first'
) {
  const fileObjects = files.map((file) => base64ToFile(file.data, file.name, file.type));
  const dataTransfer = new DataTransfer();
  fileObjects.forEach((file) => dataTransfer.items.add(file));
  dataTransfer.effectAllowed = 'all';
  dataTransfer.dropEffect = 'copy';

  const orderedStrategies = normalizeUploadStrategies(strategy);

  for (const currentStrategy of orderedStrategies) {
    if (currentStrategy === 'paste') {
      const success = await tryPasteUpload(targetElement, dataTransfer);
      if (success) {
        return true;
      }
    }

    if (currentStrategy === 'input') {
      const success = await tryInputUpload(targetElement, dataTransfer);
      if (success) {
        return true;
      }
    }

    if (currentStrategy === 'drop') {
      const success = await tryDropUpload(targetElement, dataTransfer);
      if (success) {
        return true;
      }
    }
  }

  return false;
}

function normalizeUploadStrategies(strategy: FileUploadStrategy) {
  switch (strategy) {
    case 'input-first':
      return ['input', 'paste', 'drop'] as const;
    case 'drop-first':
      return ['drop', 'input', 'paste'] as const;
    case 'input-only':
      return ['input'] as const;
    case 'paste-only':
      return ['paste'] as const;
    case 'paste-first':
    default:
      return ['paste', 'input', 'drop'] as const;
  }
}

async function tryPasteUpload(targetElement: HTMLElement, dataTransfer: DataTransfer) {
  const editableTarget = resolveEditableElement(targetElement);
  if (!(editableTarget.isContentEditable || editableTarget.getAttribute('contenteditable') === 'true')) {
    return false;
  }

  try {
    const pasteEvent = new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      composed: true,
      clipboardData: dataTransfer,
    });
    editableTarget.focus();
    editableTarget.dispatchEvent(pasteEvent);
    return true;
  } catch {
    return false;
  }
}

async function tryInputUpload(targetElement: HTMLElement, dataTransfer: DataTransfer) {
  try {
    let fileInput = targetElement.closest('form')?.querySelector('input[type="file"]') as
      | HTMLInputElement
      | null;

    if (!fileInput) {
      const inputs = Array.from(document.querySelectorAll('input[type="file"]')) as HTMLInputElement[];
      fileInput = inputs.find((input) => !input.disabled) ?? null;
    }

    if (!fileInput) {
      return false;
    }

    fileInput.files = dataTransfer.files;
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    fileInput.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  } catch {
    return false;
  }
}

async function tryDropUpload(targetElement: HTMLElement, dataTransfer: DataTransfer) {
  try {
    const eventProps = {
      bubbles: true,
      cancelable: true,
      composed: true,
      dataTransfer,
      view: window,
    };

    targetElement.dispatchEvent(new DragEvent('dragenter', eventProps));
    targetElement.dispatchEvent(new DragEvent('dragover', eventProps));
    targetElement.dispatchEvent(new DragEvent('drop', eventProps));
    document.body.dispatchEvent(new DragEvent('dragenter', eventProps));
    document.body.dispatchEvent(new DragEvent('dragover', eventProps));
    document.body.dispatchEvent(new DragEvent('drop', eventProps));
    return true;
  } catch {
    return false;
  }
}

function base64ToFile(base64Data: string, filename: string, mimeType: string): File {
  const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
  const byteCharacters = atob(cleanBase64);
  const byteArrays: ArrayBuffer[] = [];

  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
    const slice = byteCharacters.slice(offset, offset + 512);
    const byteNumbers = new Array(slice.length);

    for (let index = 0; index < slice.length; index += 1) {
      byteNumbers[index] = slice.charCodeAt(index);
    }

    byteArrays.push(new Uint8Array(byteNumbers).buffer);
  }

  const blob = new Blob(byteArrays, { type: mimeType });
  return new File([blob], filename, { type: mimeType });
}

function inferUploadStrategyFromElement(element: HTMLElement): FileUploadStrategy {
  const editable = resolveEditableElement(element);
  if (editable.isContentEditable || editable.getAttribute('contenteditable') === 'true') {
    return 'paste-first';
  }

  return 'input-first';
}

async function verifySubmission(
  inputElement: HTMLElement,
  submitSelector: SelectorSpec | undefined,
  beforeSubmitText: string,
  timeoutMs = 1500
) {
  const beforeText = beforeSubmitText.trim();
  if (!beforeText) {
    return true;
  }

  return waitForCondition(() => {
    const currentText = getElementTextSnapshot(inputElement).trim();
    if (currentText.length === 0) {
      return true;
    }

    if (currentText !== beforeText && !currentText.includes(beforeText)) {
      return true;
    }

    if (submitSelector && hasSelectorSpec(submitSelector)) {
      const submitButton = querySelectorBySpec(submitSelector, { visible: false });
      if (submitButton) {
        const buttonBusy =
          isElementDisabled(submitButton) ||
          submitButton.getAttribute('aria-busy') === 'true' ||
          submitButton.getAttribute('data-loading') === 'true' ||
          submitButton.classList.contains('loading');

        if (buttonBusy) {
          return true;
        }
      }
    }

    return false;
  }, {
    timeoutMs,
    intervalMs: 100,
  });
}

export async function runStandardFlow(
  adapter: ServiceAdapter,
  payload: UserMessagePayload,
  options?: FlowExecutionOptions,
  context?: DriverExecutionContext
) {
  const inputSelector = options?.inputSelector ?? adapter.inputSelector;
  const submitSelector = options?.submitSelector ?? adapter.submitSelector;
  const submitMode = options?.submitMode ?? adapter.submitMode ?? 'auto';
  const submitVerificationMode =
    options?.submitVerificationMode ??
    adapter.submitVerificationMode ??
    'strict';
  const prefersFirefoxInputMethod = navigator.userAgent.toLowerCase().includes('firefox');
  const inputMethod =
    (prefersFirefoxInputMethod ? adapter.firefoxInputMethod : undefined) ??
    adapter.inputMethod ??
    'default';
  const inputDebug = selectorSpecToDebugString(inputSelector);
  const submitDebug = selectorSpecToDebugString(submitSelector);

  context?.trace({ step: 'ready', status: 'start', message: `waiting for ${adapter.id}` });
  await randomDelay(...(options?.prefillDelayRange ?? [150, 350]));

  if (adapter.inputActions?.length) {
    await executeAdapterActions(adapter.inputActions);
  }

  context?.trace({ step: 'input', status: 'start', message: inputDebug });
  let inputElement: HTMLElement;
  try {
    inputElement = await waitForElement(inputSelector, {
      timeoutMs: options?.waitForInputTimeoutMs ?? 7000,
      visible: true,
    });
    context?.trace({ step: 'input', status: 'success', message: inputDebug });
    context?.trace({ step: 'ready', status: 'success', message: adapter.id });
  } catch (error) {
    context?.trace({ step: 'input', status: 'error', message: inputDebug });
    throw new DriverExecutionError(
      'input',
      'INPUT_NOT_FOUND',
      error instanceof Error ? error.message : inputDebug
    );
  }

  if (payload.files?.length) {
    const uploadStrategy =
      options?.uploadStrategy ??
      adapter.uploadStrategy ??
      inferUploadStrategyFromElement(inputElement);
    context?.trace({ step: 'upload', status: 'start', message: uploadStrategy });
    const uploaded = await uploadFiles(inputElement, payload.files, uploadStrategy);
    if (!uploaded) {
      context?.trace({ step: 'upload', status: 'error', message: uploadStrategy });
      throw new DriverExecutionError('upload', 'FILE_UPLOAD_FAILED', uploadStrategy);
    }
    context?.trace({ step: 'upload', status: 'success', message: uploadStrategy });

    await randomDelay(...(options?.postUploadDelayRange ?? [2500, 4000]));
  }

  if (payload.text) {
    context?.trace({ step: 'text', status: 'start', message: adapter.id });
    try {
      await applyInputMethod(inputElement, payload.text, inputMethod);
      context?.trace({ step: 'text', status: 'success', message: adapter.id });
    } catch (error) {
      context?.trace({
        step: 'text',
        status: 'error',
        message: error instanceof Error ? error.message : 'TEXT_NOT_APPLIED',
      });
      throw new DriverExecutionError(
        'text',
        'TEXT_NOT_APPLIED',
        error instanceof Error ? error.message : 'TEXT_NOT_APPLIED'
      );
    }
  }

  if (!payload.autoSubmit) {
    return;
  }

  await randomDelay(...(options?.beforeSubmitDelayRange ?? [250, 600]));
  const beforeSubmitText = getElementTextSnapshot(inputElement);
  const verifyTimeoutMs = Math.min(options?.waitForSubmitTimeoutMs ?? 1800, 2500);

  if (submitMode === 'enter') {
    context?.trace({ step: 'submit', status: 'start', message: 'enter' });
    await simulateEnterKey(inputElement);
    if (submitVerificationMode === 'none') {
      context?.trace({ step: 'submit', status: 'success', message: 'enter' });
      context?.trace({ step: 'verify', status: 'success', message: 'skipped' });
      return;
    }
    const enterVerified = await verifySubmission(
      inputElement,
      submitSelector,
      beforeSubmitText,
      verifyTimeoutMs
    );
    if (!enterVerified) {
      if (submitVerificationMode === 'optimistic') {
        context?.trace({ step: 'verify', status: 'success', message: 'optimistic-enter' });
        context?.trace({ step: 'submit', status: 'success', message: 'enter' });
        return;
      }
      context?.trace({ step: 'verify', status: 'error', message: 'enter' });
      throw new DriverExecutionError('verify', 'SUBMISSION_NOT_VERIFIED', 'enter');
    }
    context?.trace({ step: 'submit', status: 'success', message: 'enter' });
    context?.trace({ step: 'verify', status: 'success', message: 'enter' });
    return;
  }

  if (hasSelectorSpec(submitSelector)) {
    try {
      if (adapter.sendActions?.length) {
        await executeAdapterActions(adapter.sendActions);
      }
      context?.trace({ step: 'submit', status: 'start', message: submitDebug });
      const submitButton = await waitForElementEnabled(submitSelector, {
        timeoutMs: options?.waitForSubmitTimeoutMs ?? 7000,
      });
      clickElement(submitButton);
      if (submitVerificationMode === 'none') {
        context?.trace({ step: 'submit', status: 'success', message: submitDebug });
        context?.trace({ step: 'verify', status: 'success', message: 'skipped' });
        return;
      }
      const buttonVerified = await verifySubmission(
        inputElement,
        submitSelector,
        beforeSubmitText,
        verifyTimeoutMs
      );
      if (buttonVerified) {
        context?.trace({ step: 'submit', status: 'success', message: submitDebug });
        context?.trace({ step: 'verify', status: 'success', message: 'button' });
        return;
      }

      if (submitVerificationMode === 'optimistic') {
        context?.trace({ step: 'submit', status: 'success', message: submitDebug });
        context?.trace({ step: 'verify', status: 'success', message: 'optimistic-button' });
        return;
      }

      context?.trace({ step: 'verify', status: 'error', message: 'button-not-verified' });
    } catch (error) {
      context?.trace({
        step: 'submit',
        status: 'error',
        message: error instanceof Error ? error.message : submitDebug,
      });
      if (submitMode === 'button') {
        throw new DriverExecutionError(
          'submit',
          'SUBMIT_NOT_ENABLED',
          error instanceof Error ? error.message : submitDebug
        );
      }
    }
  }

  context?.trace({ step: 'submit', status: 'start', message: 'enter-fallback' });
  await simulateEnterKey(inputElement);
  if (submitVerificationMode === 'none') {
    context?.trace({ step: 'submit', status: 'success', message: 'enter-fallback' });
    context?.trace({ step: 'verify', status: 'success', message: 'skipped' });
    return;
  }
  const fallbackVerified = await verifySubmission(
    inputElement,
    submitSelector,
    beforeSubmitText,
    verifyTimeoutMs
  );
  if (!fallbackVerified) {
    if (submitVerificationMode === 'optimistic') {
      context?.trace({ step: 'submit', status: 'success', message: 'enter-fallback' });
      context?.trace({ step: 'verify', status: 'success', message: 'optimistic-enter-fallback' });
      return;
    }
    context?.trace({ step: 'verify', status: 'error', message: 'enter-fallback' });
    throw new DriverExecutionError(
      'verify',
      'SUBMISSION_NOT_VERIFIED',
      'enter-fallback'
    );
  }
  context?.trace({ step: 'submit', status: 'success', message: 'enter-fallback' });
  context?.trace({ step: 'verify', status: 'success', message: 'enter-fallback' });
}

export async function executeAdapterActions(actions: AdapterAction[]) {
  for (const action of actions) {
    await executeAdapterAction(action);
  }
}

export async function executeAdapterAction(action: AdapterAction) {
  switch (action.type) {
    case 'clickButtonByText': {
      const text = String(action.params.text ?? '');
      const buttons = Array.from(document.querySelectorAll('button'));
      const target = buttons.find((button) => button.textContent?.includes(text));
      target?.click();
      return;
    }
    case 'findAndSetDataId': {
      const selector = action.params.selector as SelectorSpec | undefined;
      const dataId = String(action.params.dataId ?? '');
      const element = selector ? querySelectorBySpec(selector, { visible: false }) : null;
      if (element) {
        element.setAttribute('data-id', dataId);
      }
      return;
    }
    case 'findParentAndSetDataId': {
      const selector = action.params.selector as SelectorSpec | undefined;
      const dataId = String(action.params.dataId ?? '');
      const element = selector ? querySelectorBySpec(selector, { visible: false }) : null;
      if (element?.parentElement) {
        element.parentElement.setAttribute('data-id', dataId);
      }
      return;
    }
    case 'findLastAndSetDataId': {
      const selector = action.params.selector as SelectorSpec | undefined;
      const rootSelector = action.params.rootSelector as SelectorSpec | undefined;
      const dataId = String(action.params.dataId ?? '');
      const root = rootSelector ? querySelectorBySpec(rootSelector, { visible: false }) ?? document : document;
      const elements = selector ? queryAllBySpec(selector, { root, visible: false }) : [];

      if (elements.length > 0) {
        elements[elements.length - 1].setAttribute('data-id', dataId);
      }
      return;
    }
    case 'waitForElement': {
      const selector = action.params.selector as SelectorSpec | undefined;
      const timeout = Number(action.params.timeout ?? 5000);
      if (selector && hasSelectorSpec(selector)) {
        await waitForElement(selector, { timeoutMs: timeout });
      }
      return;
    }
    case 'wait': {
      const duration = Number(action.params.duration ?? 300);
      await sleep(duration);
      return;
    }
    case 'triggerClick': {
      const selector = action.params.selector as SelectorSpec | undefined;
      const element = selector ? querySelectorBySpec(selector, { visible: false }) : null;
      element?.click();
      return;
    }
    default:
      return;
  }
}
