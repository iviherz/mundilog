/** Existing profile colors remain compatible with persisted rows. */
export function mapColor(value:string):string{return ({'#61122B':'#C6F532','#333700':'#D5B6FF','#B46A6A':'#FF83BD','#537A65':'#C6F532','#355C7D':'#D5B6FF'} as Record<string,string>)[value]||value;}
