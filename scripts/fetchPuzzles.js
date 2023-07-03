import { load } from 'cheerio'
import { writeFileSync } from 'node:fs'

async function fetchPuzzle (url) {
  return fetch(url).then(async (res) => {
    if (!res.ok) throw new Error('Failed to fetch:', url)
    return await parsePuzzle(await res.text())
  })
}

async function parsePuzzle (data) {
  const $ = load(data)
  const $root = $('.portable-infobox')
  return {
    next: $('.puzzleNav .pn-outer:last-child a').attr('href'),
    number: findData($, $root, 'number'),
    name: findData($, $root, 'frname'),
    location: findData($, $root, 'location'),
    givenBy: await fetchCharacter(findData($, $root, 'givenby')),
    solvedBy: findData($, $root, 'solvedby'),
    type: findData($, $root, 'type'),
    picarats: Number(findData($, $root, 'picarats'))
  }
}

function findData ($, $root, source) {
  return $root.find($(`[data-source="${source}"] .pi-data-value`)).text().trim() || undefined
}

async function fetchCharacter (name) {
  if (name == null) return name

  const url = `https://layton.fandom.com/wiki/${name}`
  const data = await fetch(url).then(async (res) => {
    if (!res.ok) return ''
    return res.text()
  })
  const $ = load(data)
  const frenchName = $('.portable-infobox [data-source="frname"] .pi-data-value').text().trim()
  if (frenchName !== '') return frenchName
  return name
}

function toPuzzle (puzzle) {
  return {
    number: puzzle.number,
    name: puzzle.name,
    givenBy: puzzle.givenBy,
    solvedBy: puzzle.solvedBy,
    location: puzzle.location,
    type: puzzle.type,
    picarats: puzzle.picarats
  }
}

async function getPuzzles (puzzleUrl) {
  let isLast = false
  const puzzles = []
  while (!isLast) {
    const puzzle = await fetchPuzzle(new URL(puzzleUrl, 'https://layton.fandom.com').href).catch((err) => { console.error(err.message, (puzzles.length + 1).toFixed(3)) })
    if (puzzle == null) return puzzles
    puzzles.push(puzzle)
    puzzleUrl = puzzle.next
    console.log(puzzle.number, 'done!')
    if (puzzle.next == null) isLast = true
  }
  return puzzles
}

const puzzleUrl = 'https://layton.fandom.com/wiki/Puzzle:Making_a_Scene'
getPuzzles(puzzleUrl).then((puzzles) => {
  writeFileSync('puzzles.json', JSON.stringify(puzzles.map(toPuzzle)), { encoding: 'utf-8' })
  console.log('All done!')
  process.exit(0)
}).catch((err) => {
  console.error(err)
  process.exit(1)
})
