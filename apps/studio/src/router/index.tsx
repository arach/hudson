import {
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type MouseEvent,
} from "react";
import type { StudioLinkProps, StudioRouter } from "studio";
import { normalizePath, resolveRoute, type Route } from "./routes";

export { normalizePath, resolveRoute };
export type { Route };

const listeners = new Set<() => void>();

function notify() {
  for (const fn of listeners) fn();
}

export function navigate(href: string) {
  const url = new URL(href, window.location.href);
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const next = `${url.pathname}${url.search}${url.hash}`;
  if (current === next) return;
  window.history.pushState({}, "", next);
  notify();
  if (!url.hash) window.scrollTo({ top: 0, behavior: "instant" });
}

function useSubscribedPath(): string | null {
  const [path, setPath] = useState<string | null>(() =>
    typeof window === "undefined" ? null : window.location.pathname,
  );
  useEffect(() => {
    const update = () => setPath(window.location.pathname);
    window.addEventListener("popstate", update);
    listeners.add(update);
    return () => {
      window.removeEventListener("popstate", update);
      listeners.delete(update);
    };
  }, []);
  return path;
}

function useSubscribedSearch(): URLSearchParams {
  const [params, setParams] = useState<URLSearchParams>(() =>
    typeof window === "undefined"
      ? new URLSearchParams()
      : new URLSearchParams(window.location.search),
  );
  useEffect(() => {
    const update = () =>
      setParams(new URLSearchParams(window.location.search));
    window.addEventListener("popstate", update);
    listeners.add(update);
    return () => {
      window.removeEventListener("popstate", update);
      listeners.delete(update);
    };
  }, []);
  return params;
}

function shouldIgnoreClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  );
}

const SpaLink: ComponentType<StudioLinkProps> = ({
  href,
  className,
  children,
}) => (
  <a
    href={href}
    className={className}
    onClick={(event) => {
      if (shouldIgnoreClick(event)) return;
      const url = new URL(href, window.location.href);
      if (url.origin !== window.location.origin) return;
      event.preventDefault();
      navigate(`${url.pathname}${url.search}${url.hash}`);
    }}
  >
    {children}
  </a>
);

export const spaRouter: StudioRouter = {
  Link: SpaLink,
  usePathname: useSubscribedPath,
  useSearchParams: useSubscribedSearch,
};

export function useRoute(): { path: string; route: Route } {
  const raw = useSubscribedPath() ?? "/";
  const path = normalizePath(raw);
  const route = useMemo(() => resolveRoute(path), [path]);
  return { path, route };
}
