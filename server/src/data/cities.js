// All 41 Gujarat cities covered by Gujarat Bus Seva, with approximate
// coordinates (used for maps, distance estimation & live-tracking simulation).
export const CITIES = [
  "Ahmedabad", "Gandhinagar", "Surat", "Vadodara", "Rajkot", "Bhavnagar",
  "Jamnagar", "Junagadh", "Porbandar", "Anand", "Nadiad", "Mehsana",
  "Palanpur", "Patan", "Morbi", "Bharuch", "Ankleshwar", "Vapi", "Valsad",
  "Navsari", "Godhra", "Dahod", "Himmatnagar", "Modasa", "Botad", "Amreli",
  "Veraval", "Somnath", "Dwarka", "Gandhidham", "Bhuj", "Surendranagar",
  "Wankaner", "Idar", "Deesa", "Visnagar", "Kalol", "Vyara", "Bardoli",
  "Una", "Rajpipla",
];

export const CITY_COORDS = {
  Ahmedabad: [23.03, 72.58], Gandhinagar: [23.22, 72.65], Surat: [21.17, 72.83],
  Vadodara: [22.31, 73.19], Rajkot: [22.3, 70.8], Bhavnagar: [21.76, 72.15],
  Jamnagar: [22.47, 70.06], Junagadh: [21.52, 70.46], Porbandar: [21.64, 69.63],
  Anand: [22.56, 72.96], Nadiad: [22.69, 72.86], Mehsana: [23.59, 72.37],
  Palanpur: [24.17, 72.43], Patan: [23.85, 72.12], Morbi: [22.82, 70.84],
  Bharuch: [21.71, 72.99], Ankleshwar: [21.63, 73.0], Vapi: [20.37, 72.91],
  Valsad: [20.61, 72.93], Navsari: [20.95, 72.93], Godhra: [22.78, 73.61],
  Dahod: [22.83, 74.25], Himmatnagar: [23.6, 72.96], Modasa: [23.46, 73.3],
  Botad: [22.17, 71.67], Amreli: [21.6, 71.22], Veraval: [20.9, 70.37],
  Somnath: [20.89, 70.4], Dwarka: [22.24, 68.97], Gandhidham: [23.08, 70.13],
  Bhuj: [23.24, 69.67], Surendranagar: [22.73, 71.65], Wankaner: [22.61, 70.94],
  Idar: [23.84, 73.0], Deesa: [24.26, 72.18], Visnagar: [23.7, 72.55],
  Kalol: [23.24, 72.51], Vyara: [21.11, 73.39], Bardoli: [21.12, 73.11],
  Una: [20.82, 71.04], Rajpipla: [21.78, 73.56],
};

// Seeded route network [from, to, distanceKm]. Reverse routes are created automatically.
export const ROUTE_PAIRS = [
  ["Ahmedabad", "Surat", 265], ["Ahmedabad", "Vadodara", 111],
  ["Ahmedabad", "Rajkot", 216], ["Ahmedabad", "Bhuj", 333],
  ["Ahmedabad", "Gandhinagar", 27], ["Ahmedabad", "Mehsana", 75],
  ["Ahmedabad", "Jamnagar", 308], ["Ahmedabad", "Bhavnagar", 198],
  ["Ahmedabad", "Himmatnagar", 79], ["Ahmedabad", "Anand", 74],
  ["Surat", "Vadodara", 150], ["Surat", "Navsari", 33], ["Surat", "Vapi", 119],
  ["Surat", "Valsad", 90], ["Surat", "Bardoli", 36], ["Vadodara", "Godhra", 78],
  ["Godhra", "Dahod", 74], ["Vadodara", "Bharuch", 75], ["Bharuch", "Ankleshwar", 10],
  ["Rajkot", "Jamnagar", 92], ["Rajkot", "Junagadh", 101], ["Jamnagar", "Dwarka", 131],
  ["Junagadh", "Veraval", 84], ["Veraval", "Somnath", 7], ["Junagadh", "Porbandar", 104],
  ["Rajkot", "Porbandar", 187], ["Gandhidham", "Bhuj", 57], ["Ahmedabad", "Gandhidham", 290],
  ["Rajkot", "Morbi", 67], ["Surendranagar", "Wankaner", 50], ["Wankaner", "Morbi", 28],
  ["Ahmedabad", "Surendranagar", 126], ["Mehsana", "Palanpur", 66], ["Palanpur", "Deesa", 29],
  ["Mehsana", "Patan", 45], ["Himmatnagar", "Idar", 25], ["Himmatnagar", "Modasa", 32],
  ["Bhavnagar", "Botad", 90], ["Botad", "Surendranagar", 65], ["Junagadh", "Amreli", 84],
  ["Amreli", "Una", 43], ["Anand", "Nadiad", 19], ["Vadodara", "Rajpipla", 77],
  ["Somnath", "Una", 50], ["Kalol", "Ahmedabad", 30], ["Visnagar", "Mehsana", 12],
  ["Bardoli", "Vyara", 26], ["Vadodara", "Anand", 44], ["Rajkot", "Surendranagar", 116],
  ["Surat", "Bharuch", 70], ["Navsari", "Vyara", 52], ["Bhavnagar", "Amreli", 110],
  ["Gandhinagar", "Himmatnagar", 55], ["Gandhinagar", "Mehsana", 55],
];

export const BUS_TYPES = {
  AC_SEATER: { label: "AC Seater", perKm: 1.6, seats: 36, layout: "2+2", avgKmh: 55 },
  NON_AC_SEATER: { label: "Non-AC Seater", perKm: 1.05, seats: 40, layout: "2+2", avgKmh: 52 },
  SEMI_SLEEPER: { label: "Semi Sleeper", perKm: 1.3, seats: 36, layout: "2+2", avgKmh: 53 },
  AC_SLEEPER: { label: "AC Sleeper", perKm: 2.0, seats: 30, layout: "2+1 sleeper", avgKmh: 50 },
};

export const BUSES = [
  { bus_number: "GJ-01-AB-1001", operator_name: "GBS Express", type: "AC_SEATER" },
  { bus_number: "GJ-01-AB-1002", operator_name: "Shree Shakti Travels", type: "AC_SLEEPER" },
  { bus_number: "GJ-05-BT-2001", operator_name: "Patel Roadways", type: "NON_AC_SEATER" },
  { bus_number: "GJ-05-BT-2002", operator_name: "Umiya Travels", type: "SEMI_SLEEPER" },
  { bus_number: "GJ-03-RK-3001", operator_name: "Eagle Falcon Lines", type: "AC_SLEEPER" },
  { bus_number: "GJ-03-RK-3002", operator_name: "Mahasagar Travels", type: "AC_SEATER" },
  { bus_number: "GJ-10-JM-4001", operator_name: "Neeta Gujarat", type: "NON_AC_SEATER" },
  { bus_number: "GJ-27-AJ-5001", operator_name: "GreenLine Mobility", type: "AC_SLEEPER" },
  { bus_number: "GJ-18-VV-6001", operator_name: "GSRTC Volvo Service", type: "AC_SEATER" },
  { bus_number: "GJ-01-KD-7001", operator_name: "Jalaram Travels", type: "NON_AC_SEATER" },
];

export const REVIEW_SNIPPETS = [
  "Clean bus, departed on time. Smooth booking experience!",
  "Driver was courteous and the bus was comfortable.",
  "Reached Surat 15 minutes early. Highly recommended.",
  "Seats were comfortable, AC worked well throughout.",
  "Live tracking feature is super useful for my parents.",
  "Decent ride for the price. Boarding point was easy to find.",
  "Bus was slightly late but overall a good journey.",
  "Best option for Ahmedabad–Rajkot overnight travel.",
];
