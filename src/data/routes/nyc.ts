/**
 * The New York route.
 *
 * This is content, not demo scaffolding. Fields mirror the `checkpoints` table
 * so the same data can seed a real playable race, and the demo reads from it.
 * When we generate other cities, this is the template the model gets shown.
 *
 * Rules this route follows, and any generated city should too:
 *  - clueText sets the scene and never names the place
 *  - answer is ONE distinctive word from locationAnswer, 5-9 letters
 *  - the answer never appears in the clue
 *  - challenges are specific enough that they'd fail anywhere else
 *  - funFact contains a date, name or number
 *  - each leg ends with a pitstop, and contains exactly one detour
 */

export type RouteCheckpoint = {
  name: string;
  type: 'challenge' | 'detour' | 'roadblock' | 'pitstop';
  clueType: 'text' | 'unscramble' | 'cipher' | 'wordsearch' | 'sliding';
  clueText: string;
  answer: string;
  locationAnswer: string;
  description: string;
  funFact: string;
  lat: number;
  lng: number;
  detourOptionATitle?: string;
  detourOptionADesc?: string;
  detourOptionBTitle?: string;
  detourOptionBDesc?: string;
  roadblockHint?: string;
};

export type RouteLeg = {
  name: string;
  blurb: string;
  checkpoints: RouteCheckpoint[];
};

export type CityRoute = {
  city: string;
  title: string;
  blurb: string;
  approxMinutes: number;
  approxMiles: number;
  legs: RouteLeg[];
};

export const NYC_ROUTE: CityRoute = {
  city: 'New York City',
  title: 'Forty-Second Street and Down',
  blurb: 'A straight line across Midtown, then south to where the city started.',
  approxMinutes: 240,
  approxMiles: 4.5,
  legs: [
    {
      name: 'Forty-Second Street',
      blurb: 'Five stops along one street, east to west, then north.',
      checkpoints: [
        {
          name: 'The Chrysler Building',
          type: 'challenge',
          clueType: 'unscramble',
          clueText: 'Start on the corner of Lexington and 42nd, and look up at the silver spire. In 1930 its architect kept the top hidden inside the building while a rival across town claimed the record — then raised it through the roof in ninety minutes.',
          answer: 'CHRYSLER',
          locationAnswer: 'The Chrysler Building',
          description: 'Find the steel eagles jutting out at the 61st floor and photograph one against the sky. Then go into the lobby — free, and open on weekdays — and look up at the ceiling mural.',
          funFact: 'The spire was assembled in secret inside the shaft and hoisted into place on 23 October 1929, making it the tallest building in the world for eleven months before the Empire State overtook it.',
          lat: 40.7516, lng: -73.9755,
        },
        {
          name: 'Grand Central Terminal',
          type: 'challenge',
          clueType: 'text',
          clueText: 'A block west, a few hundred thousand people cross this floor every weekday and almost none of them look up. The ceiling above is painted with the constellations in gold — and every one is back to front.',
          answer: '',
          locationAnswer: 'Grand Central Terminal',
          description: 'Go down one level to the low tiled arches outside the Oyster Bar. Face into one corner, put someone in the opposite corner, and speak into the wall. They will hear you clearly from thirty feet away. Record it.',
          funFact: 'When the ceiling was cleaned in the 1990s, restorers left one small dark rectangle near the crab untouched. It is decades of tar and nicotine, kept deliberately as a record of what the rest looked like.',
          lat: 40.7527, lng: -73.9772,
        },
        {
          name: 'The New York Public Library',
          type: 'detour',
          clueType: 'cipher',
          clueText: 'Keep going west. Two marble lions have sat on these steps since 1911, and a mayor named them during the Depression after the qualities he thought people would need to get through it.',
          answer: 'LIBRARY',
          locationAnswer: 'The New York Public Library',
          description: '',
          detourOptionATitle: 'Outside',
          detourOptionADesc: 'Quick but fiddly: work out which lion is Patience and which is Fortitude, and photograph the right one. Getting it wrong costs you nothing but pride.',
          detourOptionBTitle: 'Inside',
          detourOptionBDesc: 'Slower but certain: go up to the third floor, find the Rose Main Reading Room, and photograph the painted ceiling. Expect fifteen minutes and a security queue.',
          funFact: 'Fiorello La Guardia named them Patience and Fortitude in the 1930s. Patience is the one on the south side, on your left as you face the building.',
          lat: 40.7532, lng: -73.9822,
        },
        {
          name: 'Times Square',
          type: 'roadblock',
          clueType: 'text',
          clueText: 'Carry on west until the buildings start shouting at you. Until 1904 this was called Longacre Square, and it was mostly stables — then a newspaper moved in and the name went with it.',
          answer: '',
          locationAnswer: 'Times Square',
          roadblockHint: 'Who is least embarrassed by strangers?',
          description: 'Alone: find the small brass plaque marking the original newspaper building at One Times Square, then ask someone who is clearly a tourist which country they came from. Come back with both.',
          funFact: 'The New Year ball has dropped from One Times Square since 1907, invented because the city had banned the fireworks the paper used the year before.',
          lat: 40.7580, lng: -73.9855,
        },
        {
          name: 'Columbus Circle',
          type: 'pitstop',
          clueType: 'unscramble',
          clueText: 'Head north up Broadway to where the grid breaks and the park begins. Every official distance from this city — every road sign that says how far New York is — is measured from the monument at the centre of this roundabout.',
          answer: 'COLUMBUS',
          locationAnswer: 'Columbus Circle',
          description: 'Leg complete. Sit on the fountain steps and take a photo of the whole team with the column behind you.',
          funFact: 'The column went up in 1892 for the 400th anniversary of the crossing, and it is the official point from which every distance to New York City is measured. Every mileage sign on every approach road counts from this spot.',
          lat: 40.7681, lng: -73.9819,
        },
      ],
    },
    {
      name: 'Where It Started',
      blurb: 'Downtown, where the city was a few streets and a wall.',
      checkpoints: [
        {
          name: 'Brooklyn Bridge',
          type: 'challenge',
          clueType: 'text',
          clueText: 'Get yourself downtown and cross the East River on foot, above the traffic on wooden planks. Three bridges here carry walkways, but only this one hangs from towers of granite with two pointed arches cut through each.',
          answer: '',
          locationAnswer: 'Brooklyn Bridge',
          description: 'Walk out to the first tower and find the plaque listing the people who built it. Come back with the name of the woman on it.',
          funFact: 'Emily Warren Roebling. When her husband was disabled by decompression sickness she taught herself engineering and effectively ran the site for eleven years. She was first to cross when it opened in 1883, carrying a rooster for luck.',
          lat: 40.7061, lng: -73.9969,
        },
        {
          name: 'Trinity Church',
          type: 'challenge',
          clueType: 'unscramble',
          clueText: 'Walk south to where Wall Street ends at a churchyard. For forty years after 1846 this spire was the tallest thing in the city, and the man whose face is on the ten dollar bill is buried in the ground beside it.',
          answer: 'TRINITY',
          locationAnswer: 'Trinity Church',
          description: 'Find Alexander Hamilton\'s grave in the churchyard, then find his wife Eliza\'s beside it. Photograph the dates on both and work out how long she outlived him.',
          funFact: 'Eliza outlived him by fifty years. She spent them raising money for the first private orphanage in New York and defending his reputation against men who had been his friends.',
          lat: 40.7081, lng: -74.0119,
        },
        {
          name: 'Bowling Green',
          type: 'detour',
          clueType: 'text',
          clueText: 'Keep going south to a small oval of grass behind iron railings. This was the city\'s first public park, leased to three residents in 1733 for one peppercorn a year, and there is a bronze animal standing at the top of it.',
          answer: '',
          locationAnswer: 'Bowling Green',
          description: '',
          detourOptionATitle: 'The bull',
          detourOptionADesc: 'Fast but crowded: get a photograph of the bull with nobody else touching it. Good luck.',
          detourOptionBTitle: 'The railings',
          detourOptionBDesc: 'Slow but quiet: the fence dates from 1771 and the crowns on top were sawn off in 1776. Find where the cuts are still visible and photograph one.',
          funFact: 'The bull was not commissioned. Arturo Di Modica made it himself, trucked it to Wall Street in the middle of the night in December 1989 and left it there. The city removed it, the public complained, and it came back.',
          lat: 40.7047, lng: -74.0134,
        },
        {
          name: 'Battery Park',
          type: 'pitstop',
          clueType: 'cipher',
          clueText: 'Finish at the southern tip of the island, looking out across the harbour to the statue. A circular sandstone fort sits in the middle of the lawn, built to keep the British out in 1811.',
          answer: 'BATTERY',
          locationAnswer: 'Battery Park',
          description: 'Route complete. Find a bench facing the water and stay a while — you have earned it.',
          funFact: 'Castle Clinton was the immigration station before Ellis Island opened. Around eight million people entered the United States through that small round building between 1855 and 1890.',
          lat: 40.7033, lng: -74.0170,
        },
      ],
    },
  ],
};

/** The demo plays the first leg — five stops, every checkpoint type, ~3 minutes. */
export const DEMO_LEG = NYC_ROUTE.legs[0];
