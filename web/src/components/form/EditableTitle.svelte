<script lang="ts">
  import { onMount } from 'svelte';

  let title = $state('Inventory');
  let draft = $state('Inventory');
  let editing = $state(false);
  let inputEl: HTMLInputElement | undefined = $state();

  onMount(() => {
    const stored = localStorage.getItem('userTitle');
    if (stored) {
      title = stored;
      draft = stored;
    }
  });

  function startEditing() {
    draft = title;
    editing = true;
    requestAnimationFrame(() => inputEl?.select());
  }

  function save() {
    const trimmed = draft.trim() || title;
    localStorage.setItem('userTitle', trimmed);
    title = trimmed;
    draft = trimmed;
    editing = false;
  }

  function cancel() {
    draft = title;
    editing = false;
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      save();
    }
    if (event.key === 'Escape') cancel();
  }
</script>

<div>
  {#if editing}
    <input
      bind:this={inputEl}
      bind:value={draft}
      class="title-input"
      onkeydown={handleKeydown}
      onblur={save}
      aria-label="Inventory name"
    />
  {:else}
    <button class="title-display" onclick={startEditing}>
      <h2>{title}</h2>
    </button>
  {/if}
  <small>Click the title to edit your inventory name</small>
</div>

<style>
  h2 {
    font-family: var(--font-subtitle);
    font-weight: bold;
    font-size: var(--text-4xl);
    margin: 0;
    color: var(--accent-3-text);
  }
  .title-display {
    all: unset;
    cursor: pointer;
    display: block;
    padding: var(--space-xs);
    border-bottom: 2px solid transparent;
    &:hover,
    &:focus-visible {
      border-bottom: 2px solid var(--accent-3);
    }
  }
  .title-input {
    font-family: var(--font-subtitle);
    font-weight: bold;
    font-size: var(--text-4xl);
    color: var(--accent-3-text);
    background: transparent;
    border: none;
    border-bottom: 2px solid var(--accent-3);
    outline: none;
    padding: var(--space-xs);
    width: 100%;
  }
  small {
    font-size: var(--text-sm);
    opacity: var(--opacity-dim);
  }
</style>
