import { defineConfig } from 'vite'
import { ViteEjsPlugin } from 'vite-plugin-ejs'

import PL1 from './games/PL1.json'
import PL2 from './games/PL2.json'
import PL3 from './games/PL3.json'
import PL4 from './games/PL4.json'

const devList = { PL1, PL2, PL3, PL4 }
const prodList = { PL1, PL2, PL3 }

const games = process.env.NODE_ENV === 'development' ? devList : prodList

export default defineConfig({
  plugins: [
    ViteEjsPlugin({
      games: Object.values(games),
      translations: {
        type: 'Type d\'énigme',
        location: 'Lieu',
        solvedBy: 'Résolue par',
        givenBy: 'Proposée par'
      }
    })
  ]
})
