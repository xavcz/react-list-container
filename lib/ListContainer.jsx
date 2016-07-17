import { Meteor } from 'meteor/meteor';
import { composeWithTracker } from 'react-komposer';
import React, { PropTypes, Component } from 'react';
import CursorCounts from './cursorcounts.js';
import Utils from './utils.js'

const Subs = new SubsManager();

const listComposer = (props, onData) => {

  let terms;

  // initialize data object with current user, and default to data being ready
  let data = {
    currentUser: Meteor.user(),
    ready: true
  };

  // subscribe if needed. Note: always subscribe first, otherwise 
  // it won't work when server-side rendering with FlowRouter SSR
  if (props.publication) {
    terms = props.terms ? {...props.terms} : {};

    // set subscription terms limit based on component state
    if (!terms.options) {
      terms.options = {}
    }

    terms.options.limit = props.limit;
    terms.listId = props.listId;

    const subscribeFunction = props.cacheSubscription ? Subs.subscribe : Meteor.subscribe;
    const subscription = subscribeFunction(props.publication, terms);
    data.ready = subscription.ready();
  }

  if (data.ready) {
    const selector = props.selector || {};
    const options = {...props.options, limit: props.limit}; 
    const cursor = props.collection.find(selector, options);

    data.count = cursor.count();

    let results = cursor.fetch(); 

    // look for any specified joins
    if (props.joins) {

      // loop over each document in the results
      results.forEach(document => {

        // loop over each join
        props.joins.forEach(join => {

          const collection = typeof join.collection === "function" ? join.collection() : join.collection;
          const joinLimit = join.limit ? join.limit : 0;

          if (join.foreignProperty) {
            // foreign join (e.g. comments belonging to a post)

            // get the property containing the id
            const foreignProperty = document[join.foreignProperty];
            const joinSelector = {};
            joinSelector[join.foreignProperty] = document._id;
            document[join.joinAs] = collection.find(joinSelector);

          } else {
            // local join (e.g. a post's upvoters)

            // get the property containing the id or ids
            const localProperty = document[join.localProperty];

            if (Array.isArray(localProperty)) { // join property is an array of ids
              document[join.joinAs] = collection.find({_id: {$in: localProperty}}, {limit: joinLimit}).fetch();
            } else { // join property is a single id
              document[join.joinAs] = collection.findOne({_id: localProperty});
            }
          }

            
        });

        // return the updated document
        return document;

      });
    }
    
    // transform list into tree
    if (props.parentProperty) {
      results = Utils.unflatten(results, "_id", props.parentProperty);
    }

    // by default, always assume there's more to come while data isn't ready, and then
    // just keep showing "load more" as long as we get back as many items as we asked for
    
    data.hasMore = !data.ready || data.count === props.limit;

    if (props.increment === 0) {

      // if increment is set to 0, hasMore is always false. 
      data.hasMore = false;

    // } else if (terms && CursorCounts.get(terms)) {

    //   // note: doesn't actually work

    //   // note: it only makes sense to figure out a cursor count for cases
    //   // where we subscribe from the client to the server (i.e. `terms` should exist)

    //   const totalCount = CursorCounts.get(terms);

    //   data.totalCount = totalCount;
    //   data.hasMore = data.count < data.totalCount;

    } else if (typeof Counts !== "undefined" && Counts.get && Counts.get(props.listId)) {

      // or, use publish-counts package if available:
      // (currently only works on client)
      data.totalCount = Counts.get(props.listId);
      data.hasMore = data.count < data.totalCount;

    }

    data[props.resultsPropName] = results;

    onData(null, data);
  }
};

class ListContainer extends Component {

  constructor(...args) {
    super(...args);
    
    this.loadMore = this.loadMore.bind(this);

    this.state = {
      limit: this.props.limit
    };
  }

  loadMore(event) {
    event.preventDefault();
    this.setState({
      limit: this.state.limit + this.props.increment
    });
  }

  render() {
    const loadingComponent = this.props.loading ? this.props.loading : () => (<p>Loading…</p>);
    const ComposedComponent = composeWithTracker(listComposer, loadingComponent)(this.props.component);
    return <ComposedComponent {...this.props} limit={this.state.limit} loadMore={this.loadMore} />;
  }

}

ListContainer.propTypes = {
  collection: React.PropTypes.object.isRequired,  // the collection to paginate
  component: React.PropTypes.func.isRequired,     // the component to be wrapped
  selector: React.PropTypes.object,               // the selector used in collection.find()
  options: React.PropTypes.object,                // the options used in collection.find()
  publication: React.PropTypes.string,            // the publication to subscribe to
  terms: React.PropTypes.any,                     // an object passed to the publication
  limit: React.PropTypes.number,                  // the initial number of items to display
  increment: React.PropTypes.number,              // the limit used to increase pagination
  joins: React.PropTypes.array,                   // joins to apply to the results
  parentProperty: React.PropTypes.string,         // if provided, use to generate tree
  componentProps: React.PropTypes.object,         // the component's properties
  resultsPropName: React.PropTypes.string,        // if provided, the name of the property to use for results
  cacheSubscription: React.PropTypes.bool,        // set to true to cache subscription using Subs Manager
  listId: React.PropTypes.string,                 // a unique ID or name for the current list
}

ListContainer.defaultProps = {
  limit: 10,
  increment: 10,
  resultsPropName: "results",
  cacheSubscription: false
}

export default ListContainer;