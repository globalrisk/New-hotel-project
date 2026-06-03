export interface Room {
  id: number;
  name: string;
  description: string;
  weekdayPrice: number;
  weekendPrice: number;
  extraAdultWeekdayPrice: number;
  extraAdultWeekendPrice: number;
  extraChildWeekdayPrice: number;
  extraChildWeekendPrice: number;
  amenities: string[];
  capacity: number;
}

export const defaultRooms: Room[] = [
  {
    id: 1,
    name: 'Tổ chim 2 giường',
    description: 'Phòng tổ chim với 2 giường — tối đa 4 khách',
    weekdayPrice: 1_000_000,
    weekendPrice: 1_400_000,
    extraAdultWeekdayPrice: 200_000,
    extraAdultWeekendPrice: 280_000,
    extraChildWeekdayPrice: 100_000,
    extraChildWeekendPrice: 140_000,
    amenities: ['WiFi', 'Điều hòa', 'Ban công', 'Phòng tắm riêng'],
    capacity: 4,
  },
  {
    id: 2,
    name: 'Nhà mộc 1 giường',
    description: 'Nhà mộc 1 giường — tối đa 2 khách',
    weekdayPrice: 800_000,
    weekendPrice: 1_100_000,
    extraAdultWeekdayPrice: 150_000,
    extraAdultWeekendPrice: 200_000,
    extraChildWeekdayPrice: 80_000,
    extraChildWeekendPrice: 110_000,
    amenities: ['WiFi', 'Điều hòa', 'Phòng tắm riêng', 'Nội thất gỗ tự nhiên'],
    capacity: 2,
  },
  {
    id: 3,
    name: 'Nhà mộc 3 giường',
    description: 'Nhà mộc 3 giường — tối đa 6 khách',
    weekdayPrice: 1_600_000,
    weekendPrice: 2_000_000,
    extraAdultWeekdayPrice: 200_000,
    extraAdultWeekendPrice: 250_000,
    extraChildWeekdayPrice: 100_000,
    extraChildWeekendPrice: 125_000,
    amenities: ['WiFi', 'Điều hòa', 'Phòng tắm riêng', 'Nội thất gỗ tự nhiên'],
    capacity: 6,
  },
];
