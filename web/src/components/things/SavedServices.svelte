<script lang="ts">
  import { onMount } from 'svelte';

  import type { Service } from '../../types/Service';
  import { fetchCategories, slugify } from '@utils/fetch-data';
  import ServiceCard from './ServiceCard.svelte';

  interface Props {
    serviceList?: string[] | null;
  }
  const { serviceList = null }: Props = $props();

  interface SavedServices {
    category: string;
    section: string;
    service: Service;
  }

  let savedServices: SavedServices[] = $state([]);

  onMount(async () => {
    const saved =
      serviceList || JSON.parse(localStorage.getItem('savedServices') || '[]');
    if (!saved.length) return;

    const results: SavedServices[] = [];
    const allData = await fetchCategories();
    saved.forEach((serviceId: string) => {
      const parts = serviceId.split('/');
      const categoryName = parts[0];
      const sectionName = parts[1];
      const serviceName = parts[2];

      const category = allData.find(
        (category) => slugify(category.name) === categoryName,
      );
      if (!category) return;
      const section = category.sections.find(
        (section) => slugify(section.name) === sectionName,
      );
      if (!section) return;
      const service = section.services.find(
        (service) => slugify(service.name) === serviceName,
      );
      if (!service) return;
      results.push({ category: category.name, section: section.name, service });
    });
    savedServices = results;
  });
</script>

<div>
  {#if savedServices.length > 0}
    <div class="saved-services">
      {#each savedServices as thingy (thingy.service.name + thingy.section)}
        <ServiceCard
          categoryName={thingy.category}
          sectionName={thingy.section}
          service={thingy.service}
        />
      {/each}
    </div>
  {:else if !serviceList}
    <div class="nothing-yet">
      <p>
        Save software and services, to curate your own privacy-respecting
        software collection.
      </p>
      <small>
        All data is stored on-device, in your browser's local storage, and not
        sent anywhere unless you choose to share it
      </small>
      <p class="nope">Nothing saved yet!</p>
      <div class="footer">
        <a class="small-button" href="/all/">Browse all entries &rarr;</a>
      </div>
    </div>
  {/if}
</div>

<style lang="scss">
  .saved-services {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: var(--space-md);
    margin-top: var(--space-md);
  }

  .nothing-yet {
    background: var(--surface);
    border: var(--border-heavy);
    border-radius: var(--curve-sm);
    box-shadow: var(--shadow-md);
    padding: var(--space-md);
    width: 100%;
    box-sizing: border-box;
    margin: 0 auto;
    text-align: center;
    p {
      margin: 0;
    }
    small {
      font-size: var(--text-sm);
      opacity: var(--opacity-muted);
    }
    .nope {
      font-weight: bold;
      margin: var(--space-lg) 0 var(--space-sm);
      font-size: var(--text-xl);
      opacity: var(--opacity-muted);
    }
    .footer {
      display: flex;
      justify-content: flex-end;
      margin-top: var(--space-md);
    }
  }
</style>
