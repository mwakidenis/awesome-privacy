<script lang="ts">
  import FontAwesome from '@components/form/FontAwesome.svelte';
  import { makeRemovalRequest } from '@utils/data-src-delete-n-edit';
  import type { ServiceSource } from '@utils/fetch-line-numbers';

  interface Props {
    categoryName: string;
    sectionName: string;
    serviceName: string;
    source?: ServiceSource;
  }
  const { categoryName, sectionName, serviceName, source }: Props = $props();

  const apYaml =
    'https://github.com/lissy93/awesome-privacy/blob/main/awesome-privacy.yml';

  const yamlContent = $derived(source?.yaml ?? '');
  const lineNumbers = $derived(source?.lineNumbers);
  const editLink = $derived(
    lineNumbers
      ? `${apYaml}#L${lineNumbers.start}-L${lineNumbers.end}`
      : apYaml,
  );
</script>

<div class="actions">
  <a title="Edit" target="_blank" href={editLink}>
    <FontAwesome iconName="edit" />
  </a>
  <a
    title="Delete"
    target="_blank"
    href={makeRemovalRequest(
      categoryName,
      sectionName,
      serviceName,
      yamlContent,
    )}
  >
    <FontAwesome iconName="delete" />
  </a>
</div>

<style lang="scss">
  .actions {
    position: absolute;
    right: 3.5rem;
    top: 1rem;
    width: 2.8rem;
    gap: var(--space-md);
    opacity: 0;
    display: flex;
    transition: var(--transition-normal);
    a {
      color: var(--foreground);
      width: 1rem;
      transition: var(--transition-normal);
      &:hover {
        color: var(--accent-3-text);
        opacity: 1;
      }
    }
  }
</style>
