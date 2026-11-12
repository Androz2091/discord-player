'use client';

import {
  SearchDialog,
  SearchDialogClose,
  SearchDialogContent,
  SearchDialogFooter,
  SearchDialogHeader,
  SearchDialogIcon,
  SearchDialogInput,
  SearchDialogList,
  SearchDialogOverlay,
  type SharedProps,
} from 'fumadocs-ui/components/dialog/search';
import { useStaticSearch } from 'fumadocs-core/search/client';
import { useI18n } from 'fumadocs-ui/contexts/i18n';
import { usePathname } from 'next/navigation';
import { defaultVersionId, getDocsVersion, parseDocsPath } from '@/lib/versions';
import { VersionBadge } from './version-badge';

/**
 * Search dialog scoped to one documentation version.
 * Pages under `/docs/<version>` search that version. Everywhere else searches the default version.
 */
export default function DefaultSearchDialog(props: SharedProps) {
  const { locale } = useI18n(); // (optional) for i18n
  const pathname = usePathname();
  const version = getDocsVersion(parseDocsPath(pathname).version ?? defaultVersionId);
  const search = useStaticSearch({
    locale,
    from: `/api/search/${version.id}`,
  });

  return (
    <SearchDialog {...search} {...props}>
      <SearchDialogOverlay />
      <SearchDialogContent>
        <SearchDialogHeader>
          <SearchDialogIcon />
          <SearchDialogInput />
          <SearchDialogClose />
        </SearchDialogHeader>
        <SearchDialogList />
        <SearchDialogFooter className="flex items-center gap-2 text-xs text-fd-muted-foreground">
          Searching the {version.name} documentation
          {version.badge ? <VersionBadge badge={version.badge} /> : null}
        </SearchDialogFooter>
      </SearchDialogContent>
    </SearchDialog>
  );
}
