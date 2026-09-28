#!/usr/bin/env bun
// Read awesome-privacy.yml, parse, write a runtime JSON module
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import yaml from 'js-yaml'

const here = dirname(fileURLToPath(import.meta.url))
const ymlPath =
  process.env.AWESOME_PRIVACY_YML ?? resolve(here, '../../awesome-privacy.yml')
const outPath = resolve(here, '../src/generated/data.json')

// Pull source YAML (local path or fall back to GitHub raw)
const loadYaml = async (): Promise<string> => {
  try {
    return readFileSync(ymlPath, 'utf8')
  } catch {
    const url =
      'https://raw.githubusercontent.com/Lissy93/awesome-privacy/main/awesome-privacy.yml'
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Failed to fetch yml from ${url}`)
    return await res.text()
  }
}

const main = async () => {
  const text = await loadYaml()
  const data = yaml.load(text)
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, JSON.stringify(data))
  console.log(`Wrote ${outPath}`)
}

main()
