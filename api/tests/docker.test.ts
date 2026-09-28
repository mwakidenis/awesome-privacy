// Unit tests for the Portainer template -> docker run / compose builders
import { describe, it, expect } from 'vitest'
import { composeFile, normalize, runCommand, type Template } from '@/lib/docker'

const template: Template = {
  title: 'Pi-hole',
  image: 'pihole/pihole:latest',
  ports: ['53:53/tcp', '8080:80'],
  env: [{ name: 'TZ', default: 'UTC' }, { name: 'WEBPASSWORD' }],
  volumes: [
    { bind: '/etc/pihole', container: '/data', readonly: true },
    { container: '/cache' },
  ],
  restart_policy: 'unless-stopped',
}

describe('normalize', () => {
  it('strips symbols and lowercases', () => {
    expect(normalize('Pi-Hole!')).toBe('pihole')
  })
})

describe('runCommand', () => {
  const out = runCommand(template)

  it('lays out flags then the image last', () => {
    expect(out.startsWith('docker run -d \\')).toBe(true)
    expect(out.endsWith('pihole/pihole:latest')).toBe(true)
  })

  it('maps ports, env placeholders, read-only volumes and restart', () => {
    expect(out).toContain('-p 53:53/tcp')
    expect(out).toContain('-e WEBPASSWORD=${WEBPASSWORD}')
    expect(out).toContain('-v /etc/pihole:/data:ro')
    expect(out).toContain('--restart=unless-stopped')
  })

  it('renders a bind-less volume as an anonymous mount', () => {
    expect(out).toContain('-v /cache')
    expect(out).not.toContain('undefined')
  })
})

describe('composeFile', () => {
  const out = composeFile(template)

  it('builds a service keyed by a slugified title', () => {
    expect(out).toContain('services:')
    expect(out).toContain('pi-hole:')
    expect(out).toContain('image: "pihole/pihole:latest"')
  })

  it('quotes ports, keeps protocol and resolves env defaults', () => {
    expect(out).toContain('- "53:53/tcp"')
    expect(out).toContain('TZ: UTC')
    expect(out).toContain('WEBPASSWORD: ')
  })

  it('maps a bind-less volume to its container path', () => {
    expect(out).toContain('- /cache')
    expect(out).not.toContain('undefined')
  })

  it('drops empty sections rather than emitting bare keys or undefined', () => {
    const bare = composeFile({ title: 'bare', image: 'redis' })
    expect(bare).not.toContain('undefined')
    expect(bare).not.toContain('environment:')
    expect(bare).not.toContain('ports:')
    expect(bare).not.toContain('volumes:')
  })

  it('trims slug punctuation from the service key', () => {
    expect(composeFile({ title: 'Nextcloud (Container)', image: 'x' })).toContain(
      'nextcloud-container:',
    )
  })
})
