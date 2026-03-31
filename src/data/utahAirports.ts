export interface Airport {
  code: string
  name: string
  lat: number
  lng: number
}

// Continental Utah airports with IATA codes
const UTAH_AIRPORTS: Airport[] = [
  { code: "SLC", name: "Salt Lake City International",  lat: 40.7899, lng: -111.9791 },
  { code: "OGD", name: "Ogden-Hinckley Airport",        lat: 41.1961, lng: -112.0122 },
  { code: "PVU", name: "Provo Municipal Airport",        lat: 40.2192, lng: -111.7234 },
  { code: "SGU", name: "St. George Regional Airport",    lat: 37.0363, lng: -113.5103 },
  { code: "CDC", name: "Cedar City Regional Airport",    lat: 37.7010, lng: -113.0988 },
  { code: "CNY", name: "Canyonlands Regional Airport",   lat: 38.7550, lng: -109.7548 },
  { code: "VEL", name: "Vernal Regional Airport",        lat: 40.4409, lng: -109.5099 },
  { code: "ENV", name: "Wendover Airport",               lat: 40.7187, lng: -114.0304 },
]

export default UTAH_AIRPORTS
