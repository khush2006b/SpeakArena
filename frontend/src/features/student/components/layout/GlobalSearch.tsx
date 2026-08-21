"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Search, Loader2 } from "lucide-react";
import { useStudentLayoutStore } from "@/stores/student-layout.store";
import { apiClient } from "@/services/api/client";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";

export function GlobalSearch() {
  const { isSearchOpen, setSearchOpen } = useStudentLayoutStore();
  const router = useRouter();
  
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [setSearchOpen]);

  React.useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }
    
    const delayDebounceFn = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await apiClient.get(`/api/v1/courses?search=${encodeURIComponent(query)}&page_size=5`);
        setResults(res.data.items || res.data.courses || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  const runCommand = React.useCallback((command: () => void) => {
    setSearchOpen(false);
    command();
  }, [setSearchOpen]);

  return (
    <>
      <Button
        variant="outline"
        className="relative h-9 w-full justify-start sm:pr-12 md:w-64 lg:w-80 border-none hover:bg-white/5 transition-colors gap-2 bg-white/5 border-white/10 rounded-[10px] text-muted-foreground"
        onClick={() => setSearchOpen(true)}
      >
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="hidden lg:inline-flex font-normal text-xs">Search courses, videos, notes...</span>
        <span className="inline-flex lg:hidden font-normal text-xs">Search...</span>
        <kbd className="pointer-events-none absolute right-[0.3rem] top-[0.3rem] hidden h-6 select-none items-center gap-1 px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex bg-white/10 rounded-[4px] text-foreground">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      <CommandDialog open={isSearchOpen} onOpenChange={setSearchOpen}>
        <CommandInput placeholder="What do you want to learn today?" value={query} onValueChange={setQuery} />
        <CommandList className="bg-card">
          {loading && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
          {!loading && query.length >= 2 && results.length === 0 && (
            <CommandEmpty className="text-muted-foreground">No results found.</CommandEmpty>
          )}
          {!loading && query.length < 2 && (
            <CommandEmpty className="text-muted-foreground">Type at least 2 characters to search.</CommandEmpty>
          )}
          
          {!loading && results.length > 0 && (
            <CommandGroup heading="Courses">
              {results.map((course: any) => (
                <CommandItem key={course.id} onSelect={() => runCommand(() => router.push(`/student/courses/${course.id}`))} className="focus:bg-white/5">
                  <BookOpen className="mr-2 h-4 w-4 text-primary" />
                  <span className="text-foreground">{course.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          
        </CommandList>
      </CommandDialog>
    </>
  );
}
