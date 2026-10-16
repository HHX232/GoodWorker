// 20 openings for /chess/learn (spec §7). Main lines curated by hand after lichess-org/chess-openings (CC0);
// `lichessTag` is the family/variation name as it appears in ChessPuzzle.openingTags.
export type Opening = {
  id: string
  eco: string
  nameKey: string
  ideaKey: string
  /** the side that studies this opening */
  side: 'w' | 'b'
  /** main line, SAN */
  moves: string[]
  lichessTag: string
}

const o = (id: string, eco: string, side: 'w' | 'b', line: string, lichessTag: string): Opening => ({
  id,
  eco,
  nameKey: `op_${id}_name`,
  ideaKey: `op_${id}_idea`,
  side,
  moves: line.split(' '),
  lichessTag,
})

export const OPENINGS: Opening[] = [
  o('italian', 'C53', 'w', 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O', 'Italian_Game'),
  o('ruy-lopez', 'C90', 'w', 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O', 'Ruy_Lopez'),
  o('scotch', 'C45', 'w', 'e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Nf6 Nxc6 bxc6 e5 Qe7 Qe2 Nd5 c4', 'Scotch_Game'),
  o('kings-gambit', 'C36', 'w', 'e4 e5 f4 exf4 Nf3 d5 exd5 Nf6 Bc4 Nxd5 O-O Be7', 'Kings_Gambit_Accepted'),
  o('london', 'D02', 'w', 'd4 d5 Nf3 Nf6 Bf4 e6 e3 c5 c3 Nc6 Nbd2 Bd6 Bg3 O-O Bd3', 'Queens_Pawn_Game_London_System'),
  o('english', 'A29', 'w', 'c4 e5 Nc3 Nf6 g3 d5 cxd5 Nxd5 Bg2 Nb6 Nf3 Nc6 O-O Be7', 'English_Opening'),
  o('petrov', 'C42', 'b', 'e4 e5 Nf3 Nf6 Nxe5 d6 Nf3 Nxe4 d4 d5 Bd3 Nc6 O-O Be7', 'Russian_Game'),
  o('najdorf', 'B90', 'b', 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be3 e5 Nb3 Be6', 'Sicilian_Defense_Najdorf_Variation'),
  o('dragon', 'B76', 'b', 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6 Be3 Bg7 f3 O-O Qd2 Nc6', 'Sicilian_Defense_Dragon_Variation'),
  o('french', 'C02', 'b', 'e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3 Qb6 a3 c4', 'French_Defense'),
  o('caro-kann', 'B19', 'b', 'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5 Ng3 Bg6 h4 h6 Nf3 Nd7', 'Caro-Kann_Defense'),
  o('scandinavian', 'B01', 'b', 'e4 d5 exd5 Qxd5 Nc3 Qa5 d4 Nf6 Nf3 c6 Bc4 Bf5', 'Scandinavian_Defense'),
  o('pirc', 'B07', 'b', 'e4 d6 d4 Nf6 Nc3 g6 Be3 Bg7 Qd2 c6 f3 b5', 'Pirc_Defense'),
  o('qga', 'D27', 'b', 'd4 d5 c4 dxc4 Nf3 Nf6 e3 e6 Bxc4 c5 O-O a6', 'Queens_Gambit_Accepted'),
  o('qgd', 'D58', 'b', 'd4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 h6 Bh4 b6', 'Queens_Gambit_Declined'),
  o('slav', 'D18', 'b', 'd4 d5 c4 c6 Nf3 Nf6 Nc3 dxc4 a4 Bf5 e3 e6 Bxc4 Bb4', 'Slav_Defense'),
  o('queens-indian', 'E15', 'b', 'd4 Nf6 c4 e6 Nf3 b6 g3 Ba6 b3 Bb4+ Bd2 Be7', 'Queens_Indian_Defense'),
  o('kings-indian', 'E97', 'b', 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5 O-O Nc6 d5 Ne7', 'Kings_Indian_Defense'),
  o('nimzo-indian', 'E32', 'b', 'd4 Nf6 c4 e6 Nc3 Bb4 Qc2 O-O a3 Bxc3+ Qxc3 b6', 'Nimzo-Indian_Defense'),
  o('dutch', 'A90', 'b', 'd4 f5 g3 Nf6 Bg2 e6 Nf3 d5 O-O Bd6 c4 c6', 'Dutch_Defense'),
]

export const getOpening = (id: string) => OPENINGS.find((x) => x.id === id)
