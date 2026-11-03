export type ProfileId = string;

/** Points the game is played to. The format is recorded but all three are rated equally. */
export type GameFormat = 21 | 15 | 11;

export type Side = 'a' | 'b';

/** The club's own vocabulary. Used both for a declared seed and for a derived band. */
export type Tier = 'newbie' | 'y' | 'tby' | 'tb-plus' | 'kha';
