<script lang="ts">
  import { onMount } from 'svelte';
  import FontAwesome from '@components/form/FontAwesome.svelte';

  let theme = $state('dark');

  onMount(() => {
    theme = document.documentElement.dataset.theme || 'dark';
  });

  function toggleTheme(): void {
    theme = theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', theme);
    document.documentElement.dataset.theme = theme;
  }
</script>

<button
  class="theme-switcher"
  onclick={toggleTheme}
  aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
>
  <span class={`toggle ${theme}`}>
    <span class="theme-icon"><FontAwesome iconName="themeDark" /></span>
    <span class="theme-icon"><FontAwesome iconName="themeLight" /></span>
  </span>
</button>

<style lang="scss">
  .theme-switcher {
    cursor: pointer;
    display: inline-flex;
    padding: var(--space-xs);
    border: var(--border-heavy);
    border-radius: var(--curve-lg);
    background: var(--surface-line);
    box-shadow: var(--shadow-sm);
    transition: var(--transition-normal);

    &:hover {
      box-shadow: var(--shadow-sm-hover);
    }
  }

  .toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-sm);
    width: 4rem;
    height: 2rem;
    padding: 0 var(--space-sm);
    box-sizing: border-box;
    position: relative;
    background: var(--surface);
    border-radius: var(--curve-lg);

    &::before {
      content: '';
      position: absolute;
      top: 50%;
      left: var(--space-xs);
      width: 1.6rem;
      height: 1.6rem;
      border-radius: 50%;
      background: var(--accent-3);
      transition: transform 0.3s ease;
      transform: translateY(-50%);
    }

    &:not(.dark)::before {
      transform: translate(2.2rem, -50%);
    }
  }

  .theme-icon {
    display: flex;
    z-index: 1;
    color: var(--foreground);
    :global(svg) {
      width: 1rem;
      height: 1rem;
    }
  }

  /* Whichever icon the knob sits under needs ink that reads on it */
  .toggle.dark .theme-icon:first-child,
  .toggle:not(.dark) .theme-icon:last-child {
    color: var(--accent-3-fg);
  }
</style>
