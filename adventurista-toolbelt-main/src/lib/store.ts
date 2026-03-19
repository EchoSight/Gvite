import {
  getCharacters,
  getResources,
  saveCharacters,
  saveResources,
} from './repositories';
import {
  createCharacter as addCharacter,
  createResource as addResource,
  removeCharacter as deleteCharacter,
  removeResource as deleteResource,
  saveCharacter as updateCharacter,
} from './campaignMutations';

export {
  addCharacter,
  addResource,
  deleteCharacter,
  deleteResource,
  getCharacters,
  getResources,
  saveCharacters,
  saveResources,
  updateCharacter,
};
