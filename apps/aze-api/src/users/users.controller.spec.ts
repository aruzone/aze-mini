import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

const USER_ID = '0195f0e1-3c8a-7000-8000-2b1f9c4d5e6f';

describe('UsersController', () => {
  let controller: UsersController;

  const mockUsersService = {
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockUsersService }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('looks a User up by the uuid as given', async () => {
    await controller.findOne(USER_ID);

    expect(mockUsersService.findOne).toHaveBeenCalledWith(USER_ID);
  });

  it('updates a User by the uuid as given', async () => {
    await controller.update(USER_ID, { name: 'Ada Lovelace' });

    expect(mockUsersService.update).toHaveBeenCalledWith(USER_ID, {
      name: 'Ada Lovelace',
    });
  });

  it('deletes a User by the uuid as given', async () => {
    await controller.remove(USER_ID);

    expect(mockUsersService.remove).toHaveBeenCalledWith(USER_ID);
  });
});
