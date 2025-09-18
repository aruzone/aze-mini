import { Injectable } from '@nestjs/common';

export type User = {
  userId: number;
  username: string;
  password: string;
}

const users: User[] = [
  { userId: 1, username: 'john_doe', password: 'password123' },
  { userId: 2, username: 'jane_doe', password: 'password456' },
];

@Injectable()
export class UsersService {
  async findUserByName(username: string) {
    return users.find(user => user.username === username);
  }
}
