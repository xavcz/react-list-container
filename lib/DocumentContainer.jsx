import React, { PropTypes, Component } from 'react';
import { composeWithTracker } from 'react-komposer';

const Subs = new SubsManager();

const documentComposer = (props, onData) => {
  
  // subscribe if necessary
  const subscribeFunction = props.cacheSubscription ? Subs.subscribe : Meteor.subscribe;
  const subscription = subscribeFunction(props.publication, props.terms);

  // when the subscription is ready, "start the process" of sending data to the composed component
  if (subscription.ready()) {
    const collection = props.collection;
    const document = collection.findOne(props.selector);

    // look for any specified joins
    if (document && props.joins) {

      // loop over each join
      props.joins.forEach(join => {

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
          const joinProperty = document[join.localProperty];
          const collection = typeof join.collection === "function" ? join.collection() : join.collection;

          // perform the join
          if (Array.isArray(joinProperty)) { // join property is an array of ids
            document[join.joinAs] = collection.find({_id: {$in: joinProperty}}).fetch();
          } else { // join property is a single id
            document[join.joinAs] = collection.findOne({_id: joinProperty});
          }
        }

      });
    }

    // build the final data object
    const data = {
      currentUser: Meteor.user(),
      [props.documentPropName]: document,
    };

    // send it to the composed component
    onData(null, data);
  }
};

const DocumentContainer = (props) => {
  const loadingComponent = props.loading ? props.loading : () => (<p>Loading…</p>);

  const ComposedComponent = composeWithTracker(documentComposer, loadingComponent)(props.component);
  return <ComposedComponent {...props} />;
};

DocumentContainer.propTypes = {
  collection: React.PropTypes.object.isRequired,
  component: React.PropTypes.func.isRequired,
  publication: React.PropTypes.string.isRequired,
  selector: React.PropTypes.object.isRequired,
  terms: React.PropTypes.any,
  joins: React.PropTypes.array,
  loading: React.PropTypes.func,
  componentProps: React.PropTypes.object,
  documentPropName: React.PropTypes.string,
  cacheSubscription: React.PropTypes.bool
}

DocumentContainer.defaultProps = {
  documentPropName: "document",
  cacheSubscription: false
}


export default DocumentContainer;