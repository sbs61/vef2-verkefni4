const express = require('express');

const {
  list,
  update,
  getOne,
  createNew,
  deleteProject,
} = require('./todos');

const router = express.Router();

function catchErrors(fn) {
  return (req, res, next) => fn(req, res, next).catch(next);
}

/**
 * Display all projects in database with GET request
 * @param {Object} req Express request object
 * @param {Obhect} res Express response object
 */
async function listRoute(req, res) {
  const desc = req.query.order === 'desc';
  const order = desc ? 'id desc' : 'id asc';

  const { completed } = req.query;
  const items = await list(order, completed);

  return res.json(items);
}

/**
 * Get one project in database with GET request and id filter
 * @param {Object} req Express request object
 * @param {Obhect} res Express response object
 */
async function getOneRoute(req, res) {
  const { id } = req.params;

  const result = await getOne(id);

  if (!result.success && result.notFound) {
    return res.status(404).json({ error: 'Item not found' });
  }

  return res.status(200).json(result);
}

/**
 * Create new project in database with POST request
 * @param {Object} req Express request object
 * @param {Obhect} res Express response object
 */
async function createRoute(req, res) {
  const { title, due, position } = req.body;

  const result = await createNew(title, due, position);

  if (!result.success && result.validation.length > 0) {
    return res.status(400).json(result.validation);
  }

  return res.status(200).json(result.newProject.rows);
}

/**
 * Change project info in database with PATCH request
 * @param {Object} req Express request object
 * @param {Obhect} res Express response object
 */
async function patchRoute(req, res) {
  const { id } = req.params;
  const { title, due, position, completed } = req.body;

  const result = await update(id, { title, due, position, completed });

  if (!result.success && result.notFound) {
    return res.status(404).json({ error: 'Item not found' });
  }

  if (!result.success && result.validation.length > 0) {
    return res.status(400).json(result.validation);
  }


  return res.status(200).json(result.item);
}

/**
 * Delete project from database with DELETE request and id filter
 * @param {Object} req Express request object
 * @param {Obhect} res Express response object
 */
async function deleteRoute(req, res) {
  const { id } = req.params;

  const result = await deleteProject(id);

  if (!result.success && result.notFound) {
    return res.status(404).json({ error: 'Item not found' });
  }

  return res.status(204).json();
}

router.get('/', catchErrors(listRoute));
router.get('/:id', catchErrors(getOneRoute));
router.post('/', catchErrors(createRoute));
router.patch('/:id', catchErrors(patchRoute));
router.delete('/:id', catchErrors(deleteRoute));

module.exports = router;
