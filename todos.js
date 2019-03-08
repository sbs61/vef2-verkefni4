const xss = require('xss');
const validator = require('validator');
const { query } = require('./db');

/**
 * Get a list of all projects in the database and sort them approprietly.
 *
 * @param {string} order Order of projects, either ascending or descending order
 * @param {boolean} completed completion status of the project.
 */
async function list(order, completed) {
  if (completed !== undefined) {
    const result = await query(`SELECT * FROM projects WHERE completed=${completed} ORDER BY ${order}`);
    return result.rows;
  }

  const result = await query(`SELECT * FROM projects ORDER BY ${order}`);
  return result.rows;
}

/**
 * Check is object is empty
 * @param {object} s Object that is suppose to be checked
 */
function isEmpty(s) {
  return s == null && !s;
}

/**
 * Validates parameters to check if they are being correctly submitted
 *
 * @param {string} title Title of project
 * @param {string} due Due date of project
 * @param {number} position position of project
 * @param {boolean} completed is project completed or not?
 */
function validate(title, due, position, completed) {
  const errors = [];

  // check if title is correctly defined
  if (!isEmpty(title)) {
    if (typeof title !== 'string' || title.length === 0 || title.length > 128) {
      errors.push({
        field: 'title',
        error: 'Titill verður að vera strengur sem er 1 til 128 stafir',
      });
    }
  }

  // check if due date is correct ISO8601 format
  if (!isEmpty(due)) {
    if (!validator.isISO8601(due) && due !== '') {
      errors.push({
        field: 'due',
        error: 'Dagsetning verður að vera gild ISO 8601 dagsetning',
      });
    }
  }

  // check if position is an integer
  if (!isEmpty(position)) {
    // use string validator to check if the string is an integer
    if ((!validator.isInt(position) || parseInt(position, 10) < 0) && position !== '') {
      errors.push({
        field: 'position',
        error: 'Staðsetning verður að vera heiltala stærri eða jöfn 0',
      });
    }
  }

  // check if completed is boolean
  if (!isEmpty(completed)) {
    if (!validator.isBoolean(completed)) {
      errors.push({
        field: 'completed',
        error: 'Lokið verður að vera boolean gildi',
      });
    }
  }

  return errors;
}

/**
 * Check if title is defined when creating new project
 *
 * @param {string} title title of the project that needs to be validated
 */
function validateTitle(title) {
  const errors = [];

  if (isEmpty(title)) {
    errors.push({
      field: 'title',
      error: 'Verður að skilgreina title',
    });
  }

  return errors;
}

/**
 * Returns a project with a certain id
 *
 * @param {number} id Id of project to get
 */
async function getOne(id) {
  const result = await query('SELECT * FROM projects WHERE id = $1', [id]);

  if (result.rows.length === 0) {
    return {
      success: false,
      notFound: true,
    };
  }

  return result.rows;
}

/**
 * Creates a new project and adds it to the database.
 *
 * @param {string} title title of project
 * @param {string} due due date of project
 * @param {number} position position of project
 * @param {boolean} completed is the project completed or not
 */
async function createNew(title, due, position) {
  const validationTitle = validateTitle(title);

  // check if title is defined first
  if (validationTitle.length > 0) {
    return {
      success: false,
      validation: validationTitle,
    };
  }

  const validationResult = validate(title, due, position);

  // check if all other parameters are correct
  if (validationResult.length > 0) {
    return {
      success: false,
      validation: validationResult,
    };
  }

  const values = [title, due, position];
  // insert values into database
  await query('INSERT INTO projects(title, due, position) VALUES($1, $2, $3)', values);

  // return the latest project i.e. the one that was just created
  const newProject = await query('SELECT * FROM projects ORDER BY id DESC LIMIT 1');

  return {
    newProject,
    success: true,
  };
}

/**
 * Updates an item, either its title, text or both.
 *
 * @param {number} id Id of item to update
 * @param {object} item Item to update
 * @returns {object}
 */
async function update(id, item) {
  const result = await query('SELECT * FROM projects WHERE id = $1', [id]);

  // check if item with given id exists
  if (result.rows.length === 0) {
    return {
      success: false,
      notFound: true,
      validation: [],
    };
  }

  const validationResult = validate(item.title, item.due, item.position, item.completed);

  // check if all parameters are correct
  if (validationResult.length > 0) {
    return {
      success: false,
      notFound: false,
      validation: validationResult,
    };
  }

  // check which columns to change values of
  const changedColumns = [
    !isEmpty(item.title) ? 'title' : null,
    !isEmpty(item.due) && item.due !== '' ? 'due' : null,
    !isEmpty(item.position) && item.position !== '' ? 'position' : null,
    !isEmpty(item.completed) ? 'completed' : null,
  ].filter(Boolean);

  // check the new values
  const changedValues = [
    !isEmpty(item.title) ? xss(item.title) : null,
    !isEmpty(item.due) && item.due !== '' ? xss(item.due) : null,
    !isEmpty(item.position) && item.position !== '' ? xss(item.position) : null,
    !isEmpty(item.completed) ? xss(item.completed) : null,
  ].filter(Boolean);

  const updates = [id, ...changedValues];

  const updatedColumnsQuery = changedColumns
    .map((column, i) => `${column} = $${i + 2}`);

  // if position is sent as an empty string, set value to NULL
  if (item.position === '') {
    await query(
      `UPDATE projects
    SET position = NULL
    WHERE id = $1`, [id],
    );
  }

  // if due is sent as an empty string, set value to NULL
  if (item.due === '') {
    await query(
      `UPDATE projects
    SET due = NULL
    WHERE id = $1`, [id],
    );
  }

  // update all changes
  if (updatedColumnsQuery.length > 0) {
    await query(`
    UPDATE projects
    SET ${updatedColumnsQuery.join(', ')}
    WHERE id = $1
    RETURNING id, title, due, position, completed, created, updated`, updates);
  }

  // display the project
  const updateResult = await query('SELECT * FROM projects WHERE id = $1', [id]);
  return {
    success: true,
    item: updateResult.rows[0],
  };
}

/**
 * Deletes project with given id from the database.
 *
 * @param {number} id Id of project that is to be deleted.
 */
async function deleteProject(id) {
  const check = await query('SELECT * FROM projects WHERE id = $1', [id]);

  // check if project with this id exists
  if (check.rows.length === 0) {
    return {
      success: false,
      notFound: true,
    };
  }

  // delete the project
  const q = 'DELETE FROM projects WHERE id = $1';
  query(q, [id]);

  // return success
  return {
    success: true,
    notFound: false,
    message: 'Verkefni eytt',
  };
}

module.exports = {
  list,
  update,
  getOne,
  createNew,
  deleteProject,
};
