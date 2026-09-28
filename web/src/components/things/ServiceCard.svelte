<script lang="ts">
  import FontAwesome from '@components/form/FontAwesome.svelte';
  import SaveListing from '@components/things/SaveListing.svelte';
  import { slugify } from '@utils/fetch-data';
  import { formatLink, codebergUrl } from '@utils/parse-markdown';
  import type { Service } from 'src/types/Service';

  interface Props {
    service: Service;
    categoryName: string;
    sectionName: string;
  }
  const { service, categoryName, sectionName }: Props = $props();

  const serviceRef = $derived(slugify(service.name));
  const categorySlug = $derived(slugify(categoryName));
  const sectionSlug = $derived(slugify(sectionName));
</script>

<div class="service" id={serviceRef}>
  <div class="service-head">
    <a
      class="service-title"
      href={`/${categorySlug}/${sectionSlug}/${serviceRef}/`}
    >
      <h4>{service.name}</h4>
    </a>
    {#if service.followWith}
      <p class="follow-with">({service.followWith})</p>
    {/if}
  </div>

  <div class="save-listing">
    <SaveListing {categoryName} {sectionName} serviceName={service.name} />
  </div>

  <div class="service-body">
    <img
      width="40"
      height="40"
      loading="lazy"
      decoding="async"
      class="service-icon"
      alt={`${service.name} Icon`}
      data-service-url={formatLink(service.url)}
      src={service.icon || `https://icon.horse/icon/${formatLink(service.url)}`}
    />
    <div class="service-body">
      <!-- eslint-disable-next-line svelte/no-at-html-tags -- description is from curated YAML data, not user input -->
      <p>{@html service.description}</p>
    </div>
  </div>

  <div class="service-links">
    <a
      class="link"
      href={service.url}
      target="_blank"
      rel="noopener noreferrer"
    >
      <FontAwesome iconName="website" /> <span>{formatLink(service.url)}</span>
    </a>
    {#if service.github}
      <a
        class="link"
        href={`https://github.com/${service.github}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        <FontAwesome iconName="sourceCode" /> GitHub
      </a>
    {/if}
    {#if service.codeberg}
      <a
        class="link"
        href={codebergUrl(service.codeberg)}
        target="_blank"
        rel="noopener noreferrer"
      >
        <FontAwesome iconName="sourceCode" /> Codeberg
      </a>
    {/if}
    {#if service.git}
      <a
        class="link"
        href={service.git}
        target="_blank"
        rel="noopener noreferrer"
      >
        <FontAwesome iconName="sourceCode" /> Source
      </a>
    {/if}
    <a href={`/${categorySlug}/${sectionSlug}/${serviceRef}/`}>
      <FontAwesome iconName="viewReport" /> View Report ➔
    </a>
  </div>
</div>

<style lang="scss">
  @use './service-card.scss';
</style>
