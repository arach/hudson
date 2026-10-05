/** Domain-free subject, selection and captured context shared by panel renderers. */
export interface EditorSubject { id: string; kind: string; label: string; revision: string }
export interface ContextRef { kind: string; id: string; label: string; detail?: string; snapshotId?: string }
export interface SourceRange { from: number; to: number }
export interface EditorSelection {
  origin: string;
  refs: readonly ContextRef[];
  ranges: readonly SourceRange[];
  ambiguous: boolean;
}
export interface SubjectSnapshot { subject: EditorSubject | null; selection: EditorSelection }
const empty = (): EditorSelection => ({ origin: '', refs: [], ranges: [], ambiguous: false });
export function createSubjectStore() {
  let state: SubjectSnapshot = { subject: null, selection: empty() };
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach(listener => listener());
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    setSubject(subject: EditorSubject) {
      const changed = state.subject?.id !== subject.id || state.subject?.revision !== subject.revision;
      state = { subject: { ...subject }, selection: changed ? empty() : state.selection }; emit();
    },
    select(selection: EditorSelection) {
      state = { ...state, selection: structuredClone(selection) }; emit();
    },
    clear() { state = { ...state, selection: empty() }; emit(); },
    capture() { return structuredClone({ subject: state.subject, refs: state.selection.refs }); },
  };
}
export type SubjectStore = ReturnType<typeof createSubjectStore>;
