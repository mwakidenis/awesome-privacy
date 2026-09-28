// Turns a Portainer template into docker run / compose usage output

export interface TemplateEnv {
  name: string
  label?: string
  default?: string
  description?: string
}

export interface TemplateVolume {
  container: string
  bind?: string
  readonly?: boolean
}

export interface Template {
  title?: string
  name?: string
  image?: string
  logo?: string
  description?: string
  categories?: string[]
  ports?: string[]
  env?: TemplateEnv[]
  volumes?: TemplateVolume[]
  restart_policy?: string
}

// Strip everything but alphanumerics so loose name matching works
export const normalize = (str: string) => str.replace(/[^a-z0-9]/gi, '').toLowerCase()

// Minimal YAML serialiser, enough for the compose object we build
const toYaml = (data: unknown, indent = ''): string[] => {
  const lines: string[] = []
  if (Array.isArray(data)) {
    for (const el of data) lines.push(`${indent}- ${scalar(el)}`)
  } else if (data && typeof data === 'object') {
    for (const [key, value] of Object.entries(data)) {
      if (value === undefined || value === null) continue
      if (typeof value === 'object') {
        const child = toYaml(value, `${indent}  `)
        if (!child.length) continue
        lines.push(`${indent}${key}:`)
        lines.push(...child)
      } else {
        lines.push(`${indent}${key}: ${scalar(value)}`)
      }
    }
  }
  return lines
}

// Quote scalars holding a colon so ports/images aren't misread as YAML maps or sexagesimals
const scalar = (value: unknown): string => {
  const str = String(value)
  return str.includes(':') ? `"${str}"` : str
}

// Volume mount, host:container when a host bind is given, else an anonymous volume
const mount = (vol: TemplateVolume) =>
  vol.bind ? `${vol.bind}:${vol.container}` : vol.container

// A copy-pasteable `docker run` command for the template
export const runCommand = (t: Template): string => {
  const parts = ['docker run -d']
  for (const port of t.ports ?? []) parts.push(`-p ${port}`)
  for (const env of t.env ?? []) parts.push(`-e ${env.name}=\${${env.name}}`)
  for (const vol of t.volumes ?? []) {
    parts.push(`-v ${mount(vol)}${vol.readonly ? ':ro' : ''}`)
  }
  if (t.restart_policy) parts.push(`--restart=${t.restart_policy}`)
  parts.push(t.image ?? '')
  return parts.join(' \\\n  ')
}

// Equivalent docker-compose.yml as a YAML string
export const composeFile = (t: Template): string => {
  const service =
    (t.title ?? 'app')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'app'
  const compose = {
    version: '3.8',
    services: {
      [service]: {
        image: t.image,
        ports: t.ports ?? [],
        environment: Object.fromEntries(
          (t.env ?? []).map((e) => [e.name, e.default ?? '']),
        ),
        volumes: (t.volumes ?? []).map(mount),
        restart: t.restart_policy,
      },
    },
  }
  return toYaml(compose).join('\n')
}
