import fs from 'node:fs';

const exercisePath = new URL('../src/modules/activity/exercise-catalog.ts', import.meta.url);
const foodPath = new URL('../src/modules/foods/catalog.ts', import.meta.url);

const groups = {
  Chest: [
    'Barbell Bench Press', 'Incline Barbell Bench Press', 'Decline Barbell Bench Press', 'Dumbbell Bench Press',
    'Incline Dumbbell Press', 'Decline Dumbbell Press', 'Dumbbell Fly', 'Incline Dumbbell Fly', 'Cable Fly',
    'Low Cable Fly', 'High Cable Fly', 'Pec Deck', 'Machine Chest Press', 'Push Up', 'Diamond Push Up',
    'Wide Push Up', 'Decline Push Up', 'Incline Push Up', 'Chest Dip', 'Svend Press', 'Landmine Press',
    'Floor Press', 'Close Grip Bench Press', 'Smith Machine Bench Press', 'Guillotine Press',
    'Single Arm Cable Fly', 'Plate Press', 'Resistance Band Chest Press', 'Medicine Ball Chest Pass', 'Clap Push Up',
  ],
  Back: [
    'Pull Up', 'Chin Up', 'Lat Pulldown', 'Wide Grip Lat Pulldown', 'Close Grip Lat Pulldown', 'Barbell Row',
    'Pendlay Row', 'Yates Row', 'T-Bar Row', 'Dumbbell Row', 'Chest Supported Row', 'Seated Cable Row',
    'One Arm Cable Row', 'Face Pull', 'Straight Arm Pulldown', 'Deadlift', 'Romanian Deadlift', 'Sumo Deadlift',
    'Rack Pull', 'Good Morning', 'Hyperextension', 'Reverse Hyperextension', 'Meadows Row', 'Seal Row',
    'Inverted Row', 'Australian Pull Up', 'Kroc Row', 'Shrugs', 'Dumbbell Shrugs', 'Trap Bar Deadlift',
    'Cable Pullover', 'Machine Row', 'Single Arm Lat Pulldown', 'Wide Grip Pull Up', 'Neutral Grip Pull Up',
  ],
  Shoulders: [
    'Overhead Press', 'Push Press', 'Dumbbell Shoulder Press', 'Arnold Press', 'Seated Dumbbell Press',
    'Military Press', 'Landmine Shoulder Press', 'Lateral Raise', 'Cable Lateral Raise', 'Front Raise',
    'Rear Delt Fly', 'Reverse Pec Deck', 'Upright Row', 'Barbell Shrug', 'Dumbbell Cuban Press', 'Z Press',
    'Machine Shoulder Press', 'Pike Push Up', 'Handstand Push Up', 'Band Pull Apart', 'Cable Front Raise',
    'Dumbbell Y Raise', 'Plate Front Raise', 'Single Arm Overhead Press', 'Bradford Press', 'Behind Neck Press',
    'Snatch Grip High Pull', 'Scarecrow', 'Bus Driver', 'Cable Rear Delt Fly',
  ],
  Legs: [
    'Barbell Back Squat', 'Front Squat', 'Goblet Squat', 'Hack Squat', 'Leg Press', 'Bulgarian Split Squat',
    'Walking Lunge', 'Reverse Lunge', 'Side Lunge', 'Step Up', 'Stiff Leg Deadlift', 'Leg Curl',
    'Lying Leg Curl', 'Seated Leg Curl', 'Leg Extension', 'Calf Raise', 'Seated Calf Raise', 'Donkey Calf Raise',
    'Hip Thrust', 'Glute Bridge', 'Cable Kickback', 'Sumo Squat', 'Pistol Squat', 'Box Squat', 'Pause Squat',
    'Smith Machine Squat', 'Belt Squat', 'Nordic Curl', 'Sissy Squat', 'Adductor Machine', 'Abductor Machine',
    'Frog Pump', 'Single Leg RDL', 'Deficit Lunge', 'Curtsy Lunge', 'Wall Sit', 'Jump Squat', 'Broad Jump',
    'Thruster', 'Jefferson Squat',
  ],
  Arms: [
    'Barbell Curl', 'Dumbbell Curl', 'Hammer Curl', 'Incline Curl', 'Preacher Curl', 'Cable Curl',
    'Concentration Curl', 'Spider Curl', 'Zottman Curl', 'Bayesian Curl', 'Tricep Pushdown', 'Rope Pushdown',
    'Overhead Tricep Extension', 'Skull Crusher', 'Close Grip Bench Arms', 'Tricep Dip', 'Kickback',
    'JM Press', 'French Press', 'Reverse Curl', 'Wrist Curl', 'Reverse Wrist Curl', 'Farmer Carry',
    'Cross Body Hammer Curl', '21s Curl', 'Drag Curl', 'Single Arm Pushdown', 'Bench Dip', 'Cable Overhead Extension',
    'EZ Bar Curl',
  ],
  Core: [
    'Plank', 'Side Plank', 'Dead Bug', 'Bird Dog', 'Hanging Leg Raise', 'Lying Leg Raise', 'Cable Crunch',
    'Ab Wheel Rollout', 'Russian Twist', 'Bicycle Crunch', 'Mountain Climber', 'V Up', 'Hollow Hold',
    'Dragon Flag', 'Pallof Press', 'Woodchop', 'Hanging Knee Raise', 'Toe Touch Crunch', 'Flutter Kick',
    'Superman', 'Cable Twist', 'Decline Sit Up', 'Weighted Sit Up', 'Copenhagen Plank', 'L Sit', 'Toes to Bar',
    'Windshield Wiper', 'Stability Ball Crunch', 'Medicine Ball Slam', 'Farmer March',
  ],
  Cardio: [
    'Treadmill Run', 'Treadmill Walk', 'Incline Walk', 'Outdoor Run', 'Outdoor Walk', 'Cycling',
    'Stationary Bike', 'Assault Bike', 'Rowing Machine', 'Elliptical', 'Stair Climber', 'Jump Rope',
    'Burpee', 'High Knees', 'Jumping Jack', 'Box Jump', 'Battle Rope', 'Ski Erg', 'Swimming', 'Shadow Boxing',
    'Kettlebell Swing', 'Sled Push', 'Sled Pull', 'Row Sprint', 'Bike Sprint', 'Hill Sprint', 'Tabata Circuit',
    'HIIT Circuit', 'Dance Cardio', 'Stair Run', 'Trail Run', 'Power Walk', 'Spin Class', 'Aerobics', 'Jogging',
  ],
  Olympic: [
    'Clean', 'Power Clean', 'Hang Clean', 'Clean and Jerk', 'Power Jerk', 'Split Jerk', 'Snatch', 'Power Snatch',
    'Hang Snatch', 'Snatch Balance', 'Push Jerk', 'Muscle Clean', 'Muscle Snatch', 'Clean Pull', 'Snatch Pull',
    'High Hang Clean', 'High Hang Snatch', 'Dumbbell Clean', 'Dumbbell Snatch', 'Kettlebell Clean',
  ],
  Mobility: [
    'World Greatest Stretch', 'Hip Flexor Stretch', 'Hamstring Stretch', 'Pigeon Pose', 'Couch Stretch',
    'Thoracic Opener', 'Cat Cow', 'Thread the Needle', 'Shoulder Dislocate', 'Ankle Mobility Drill',
    '90 90 Hip Stretch', 'Foam Roll Quads', 'Foam Roll Back', 'Foam Roll IT Band', 'Banded Shoulder Distraction',
    'Wrist Mobility', 'Neck Mobility Circles', 'Hip Circles', 'Leg Swings', 'Arm Circles', 'Deep Squat Hold',
    'Child Pose', 'Downward Dog', 'Cobra Stretch', 'Figure Four Stretch', 'Seated Forward Fold',
    'Standing Quad Stretch', 'Chest Opener Doorway', 'Lat Stretch', 'Calf Stretch',
  ],
  Machines: [
    'Chest Press Machine', 'Shoulder Press Machine', 'Lat Pulldown Machine', 'Seated Row Machine',
    'Leg Press Machine', 'Hack Squat Machine', 'Leg Extension Machine', 'Leg Curl Machine', 'Calf Raise Machine',
    'Pec Deck Machine', 'Cable Cross Over', 'Assisted Pull Up Machine', 'Assisted Dip Machine',
    'Glute Kickback Machine', 'Hip Abduction Machine', 'Torso Rotation Machine', 'Smith Machine Row',
    'Selectorized Biceps Curl', 'Selectorized Triceps Extension', 'Recumbent Bike',
  ],
};

const items = [];
for (const [muscleGroup, names] of Object.entries(groups)) {
  for (const name of names) items.push({ name, muscleGroup });
}

const bases = ['Cable', 'Dumbbell', 'Barbell', 'Machine', 'Band', 'Kettlebell'];
const moves = ['Press', 'Row', 'Curl', 'Extension', 'Raise', 'Fly', 'Squat', 'Lunge', 'Pull', 'Push', 'Hold', 'Carry', 'Swing', 'Thrust', 'Crunch'];
const targets = ['Chest', 'Back', 'Shoulders', 'Legs', 'Arms', 'Core'];
let i = 0;
const seen = new Set(items.map((x) => x.name));
while (items.length < 480 && i < 3000) {
  const b = bases[i % bases.length];
  const m = moves[Math.floor(i / bases.length) % moves.length];
  const t = targets[i % targets.length];
  const name = `${b} ${t} ${m} ${Math.floor(i / 30) + 1}`;
  if (!seen.has(name)) {
    seen.add(name);
    items.push({ name, muscleGroup: t });
  }
  i += 1;
}

fs.writeFileSync(
  exercisePath,
  `export type ExerciseCatalogItem = { name: string; muscleGroup: string };\n\nexport const EXERCISE_CATALOG: ExerciseCatalogItem[] = ${JSON.stringify(items, null, 2)};\n`,
);

/** @type {Array<{id:string,name:string,brand:string,category:string,servingUnit:string,servingGrams:number,calories:number,proteinG:number,carbsG:number,fatG:number}>} */
const foods = [];

function add(category, name, brand, servingUnit, servingGrams, calories, proteinG, carbsG, fatG) {
  foods.push({
    id: `${category}-${foods.length + 1}`,
    name,
    brand,
    category,
    servingUnit,
    servingGrams,
    calories,
    proteinG,
    carbsG,
    fatG,
  });
}

// Pakistani staples
const pak = [
  ['Chicken Biryani', 'plate', 350, 520, 28, 62, 16],
  ['Beef Biryani', 'plate', 350, 580, 30, 60, 22],
  ['Mutton Biryani', 'plate', 350, 610, 32, 58, 24],
  ['Chicken Karahi', 'serving', 250, 420, 36, 8, 28],
  ['Mutton Karahi', 'serving', 250, 480, 34, 6, 34],
  ['Beef Nihari', 'bowl', 300, 510, 32, 12, 35],
  ['Haleem', 'bowl', 300, 430, 26, 38, 16],
  ['Chicken Handi', 'serving', 250, 450, 34, 10, 30],
  ['Butter Chicken', 'serving', 250, 490, 32, 14, 32],
  ['Chicken Tikka', '6 pieces', 180, 320, 38, 4, 16],
  ['Seekh Kebab', '2 pieces', 120, 280, 22, 4, 20],
  ['Chapli Kebab', '1 piece', 100, 260, 18, 8, 18],
  ['Daal Mash', 'bowl', 220, 240, 14, 32, 6],
  ['Daal Chana', 'bowl', 220, 230, 13, 34, 5],
  ['Chana Masala', 'bowl', 250, 310, 14, 40, 10],
  ['Aloo Gosht', 'bowl', 280, 390, 26, 22, 20],
  ['Palak Paneer', 'serving', 220, 340, 16, 14, 24],
  ['Paneer Tikka', '6 pieces', 180, 360, 22, 8, 26],
  ['Samosa', '1 piece', 70, 180, 4, 20, 10],
  ['Pakora', '4 pieces', 100, 220, 6, 18, 14],
  ['Paratha Plain', '1 piece', 90, 260, 5, 32, 12],
  ['Aloo Paratha', '1 piece', 120, 320, 6, 38, 15],
  ['Naan', '1 piece', 90, 280, 8, 48, 6],
  ['Rogni Naan', '1 piece', 100, 320, 8, 50, 10],
  ['Roti / Chapati', '1 piece', 40, 120, 3, 22, 2],
  ['Puri', '1 piece', 35, 140, 2, 16, 8],
  ['Chicken Pulao', 'plate', 320, 460, 24, 55, 14],
  ['Beef Pulao', 'plate', 320, 500, 26, 52, 18],
  ['Keema', 'serving', 200, 360, 28, 6, 24],
  ['Anda Curry', '2 eggs', 200, 280, 16, 8, 20],
  ['Halwa Puri Plate', 'plate', 350, 650, 12, 70, 34],
  ['Chana Chaat', 'bowl', 200, 260, 10, 36, 8],
  ['Fruit Chaat', 'bowl', 180, 160, 2, 36, 1],
  ['Dahi Bhalla', 'serving', 180, 240, 8, 28, 10],
  ['Gol Gappay', '6 pieces', 150, 220, 4, 34, 8],
  ['Jalebi', '2 pieces', 60, 200, 1, 36, 6],
  ['Gulab Jamun', '2 pieces', 80, 240, 4, 34, 10],
  ['Kheer', 'bowl', 180, 260, 6, 40, 8],
  ['Lassi Sweet', 'glass', 300, 220, 8, 30, 8],
  ['Lassi Salty', 'glass', 300, 160, 8, 12, 8],
  ['Chai Doodh Patti', 'cup', 180, 120, 4, 14, 5],
  ['Kashmiri Chai', 'cup', 200, 150, 5, 16, 6],
  ['Nihari Naan Combo', 'plate', 450, 780, 38, 70, 36],
  ['Chicken Shawarma Roll', '1 roll', 250, 480, 28, 42, 22],
  ['Beef Bun Kebab', '1 piece', 180, 420, 20, 34, 22],
  ['Anda Paratha', '1 plate', 220, 430, 16, 36, 24],
  ['Fish Fry', 'serving', 180, 340, 30, 12, 18],
  ['Prawn Masala', 'serving', 220, 360, 28, 10, 22],
  ['Mutton Kunna', 'bowl', 280, 520, 34, 10, 36],
  ['Chicken Corn Soup', 'bowl', 250, 180, 12, 16, 6],
];
for (const [name, unit, grams, cal, p, c, f] of pak) {
  add('pakistani', name, 'Calora Kitchen', unit, grams, cal, p, c, f);
}

const fast = [
  ['Cheeseburger', 'Generic Fast Food', '1 burger', 150, 540, 28, 40, 30],
  ['Double Cheeseburger', 'Generic Fast Food', '1 burger', 220, 740, 42, 42, 44],
  ['Chicken Burger', 'Generic Fast Food', '1 burger', 180, 520, 30, 44, 24],
  ['Zinger-style Burger', 'Generic Fast Food', '1 burger', 200, 590, 32, 48, 28],
  ['French Fries Small', 'Generic Fast Food', 'small', 100, 320, 4, 42, 15],
  ['French Fries Medium', 'Generic Fast Food', 'medium', 140, 420, 5, 54, 20],
  ['French Fries Large', 'Generic Fast Food', 'large', 180, 540, 6, 68, 26],
  ['Chicken Nuggets 6pc', 'Generic Fast Food', '6 pieces', 100, 280, 16, 16, 16],
  ['Chicken Nuggets 9pc', 'Generic Fast Food', '9 pieces', 150, 420, 24, 24, 24],
  ['Fried Chicken Piece', 'Generic Fast Food', '1 piece', 120, 320, 22, 10, 20],
  ['Fried Chicken Bucket Piece', 'Generic Fast Food', '1 piece', 130, 350, 24, 12, 22],
  ['Pizza Slice Cheese', 'Generic Fast Food', '1 slice', 110, 280, 12, 32, 10],
  ['Pizza Slice Pepperoni', 'Generic Fast Food', '1 slice', 115, 310, 13, 32, 13],
  ['Pizza Slice BBQ Chicken', 'Generic Fast Food', '1 slice', 120, 300, 14, 34, 11],
  ['Personal Pizza', 'Generic Fast Food', '1 pizza', 350, 820, 34, 90, 32],
  ['Chicken Wrap', 'Generic Fast Food', '1 wrap', 220, 460, 28, 40, 18],
  ['Beef Wrap', 'Generic Fast Food', '1 wrap', 230, 500, 30, 38, 22],
  ['Loaded Fries', 'Generic Fast Food', 'serving', 280, 680, 18, 62, 38],
  ['Onion Rings', 'Generic Fast Food', '6 pieces', 100, 300, 4, 32, 18],
  ['Hot Dog', 'Generic Fast Food', '1 piece', 130, 350, 12, 28, 20],
  ['Club Sandwich', 'Generic Fast Food', '1 sandwich', 250, 560, 32, 44, 26],
  ['Chicken Sandwich Crispy', 'Generic Fast Food', '1 sandwich', 210, 550, 28, 46, 26],
  ['Fish Sandwich', 'Generic Fast Food', '1 sandwich', 190, 480, 22, 44, 22],
  ['Cola Regular', 'Soft Drink', 'can 330ml', 330, 140, 0, 39, 0],
  ['Cola Large', 'Soft Drink', 'large cup', 500, 210, 0, 58, 0],
  ['Orange Soda', 'Soft Drink', 'can 330ml', 330, 150, 0, 41, 0],
  ['Milkshake Chocolate', 'Generic Fast Food', 'medium', 350, 520, 12, 72, 18],
  ['Milkshake Vanilla', 'Generic Fast Food', 'medium', 350, 490, 12, 68, 16],
  ['Ice Cream Cone', 'Generic Fast Food', '1 cone', 100, 240, 4, 32, 10],
  ['Soft Serve Sundae', 'Generic Fast Food', '1 cup', 150, 320, 6, 44, 12],
  ['Donut Glazed', 'Bakery Fast Food', '1 piece', 60, 260, 3, 32, 14],
  ['Croissant', 'Bakery Fast Food', '1 piece', 70, 280, 5, 28, 16],
  ['Breakfast Egg Muffin', 'Generic Fast Food', '1 sandwich', 140, 300, 16, 28, 12],
  ['Hash Browns', 'Generic Fast Food', '1 piece', 60, 150, 2, 16, 9],
  ['Mozzarella Sticks', 'Generic Fast Food', '4 pieces', 100, 340, 14, 26, 20],
  ['Garlic Bread', 'Generic Fast Food', '2 pieces', 80, 220, 5, 28, 10],
  ['Pasta Alfredo Fast Serve', 'Generic Fast Food', 'bowl', 350, 620, 22, 58, 30],
  ['Chicken Broast Quarter', 'Local Fast Food', 'quarter', 250, 560, 38, 18, 36],
  ['Chicken Broast Half', 'Local Fast Food', 'half', 450, 980, 68, 30, 62],
  ['Fajita Roll', 'Local Fast Food', '1 roll', 230, 470, 26, 40, 20],
];
for (const [name, brand, unit, grams, cal, p, c, f] of fast) {
  add('fast_food', name, brand, unit, grams, cal, p, c, f);
}

fs.writeFileSync(
  foodPath,
  `export type FoodCatalogItem = {
  id: string;
  name: string;
  brand: string;
  category: 'pakistani' | 'fast_food';
  servingUnit: string;
  servingGrams: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export const FOOD_CATALOG: FoodCatalogItem[] = ${JSON.stringify(foods, null, 2)};

export function searchFoodCatalog(query: string, category?: string) {
  const q = query.trim().toLowerCase();
  return FOOD_CATALOG.filter((item) => {
    if (category && item.category !== category) return false;
    if (!q) return true;
    return (
      item.name.toLowerCase().includes(q) ||
      item.brand.toLowerCase().includes(q) ||
      item.category.replace('_', ' ').includes(q)
    );
  });
}
`,
);

console.log({ exercises: items.length, foods: foods.length });
